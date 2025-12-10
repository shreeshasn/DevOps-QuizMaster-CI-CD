// Jenkinsfile - simple Windows-friendly, agent:any
pipeline {
  agent any

  environment {
    DOCKER_REPO = "shreeshasn/devops-quizmaster"
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timestamps()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Prepare') {
      steps {
        powershell '''
# short git sha into file and set IMAGE_TAG
git rev-parse --short HEAD > .gitsha
$git = Get-Content .gitsha -Raw
$env:IMAGE_TAG = "${DOCKER_REPO}:${BRANCH_NAME}-$git".Trim()
Write-Host "IMAGE_TAG = $env:IMAGE_TAG"
'''
      }
    }

    stage('Set API key & Install') {
      steps {
        // create secret text credential in Jenkins with id 'quiz-api-key'
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          powershell '''
Set-Content -Path .env.local -Value ("VITE_API_KEY={0}" -f $env:QUIZ_API_KEY) -Force
Write-Host ".env.local created"
npm --version
npm ci
'''
        }
      }
    }

    stage('Build') {
      steps {
        powershell 'npm run build'
      }
    }

    stage('Docker Build') {
      steps {
        powershell '''
# If Docker daemon requires DOCKER_HOST on this agent, set it here (optional)
# setx DOCKER_HOST "tcp://127.0.0.1:2375" > $null 2>&1 || Write-Host "setx may require restart - continuing"
docker build -t $env:IMAGE_TAG .
docker images --filter=reference=$env:IMAGE_TAG
'''
      }
    }

    stage('Docker Push') {
      steps {
        // Create a Jenkins credential of type "Username with password" id 'dockerhub-creds'
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          powershell '''
# login and push
$pw = $env:DOCKER_PASS
# Use docker login via stdin
$pw | docker login -u $env:DOCKER_USER --password-stdin
docker push $env:IMAGE_TAG
docker logout || Write-Host "docker logout failed but continuing"
'''
        }
      }
    }

    stage('Optional: Deploy to Kubernetes') {
      when {
        expression { fileExists('k8s/deployment.yaml') }
      }
      steps {
        // add a Jenkins secret file credential named 'kubeconfig' (content = your kubeconfig)
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
          powershell '''
$env:KUBECONFIG = "${env:KUBECONF}"
$img = $env:IMAGE_TAG

if (kubectl get deployment devops-quizmaster-deployment -o name 2>$null) {
  Write-Host "Updating image on existing deployment..."
  kubectl set image deployment/devops-quizmaster-deployment app=$img --record
  kubectl rollout status deployment/devops-quizmaster-deployment --timeout=120s
} else {
  Write-Host "Applying manifest with image replacement..."
  (Get-Content .\\k8s\\deployment.yaml) -replace '__IMAGE_PLACEHOLDER__', $img | kubectl apply -f -
  kubectl rollout status deployment/devops-quizmaster-deployment --timeout=120s
}
'''
        }
      }
    }

    stage('Notify (Slack)') {
      when {
        expression { return env.BUILD_ID != null } // runs only when an agent/executor was available
      }
      steps {
        // create a Jenkins secret text credential 'slack-webhook' with the webhook URL
        withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
          powershell '''
$result = "${currentBuild.currentResult}: ${env.JOB_NAME} [${env.BRANCH_NAME}] #${env.BUILD_NUMBER} -> ${env:IMAGE_TAG}"
$body = @{ text = $result } | ConvertTo-Json
try {
  Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body $body -ErrorAction Stop
  Write-Host "Slack notified"
} catch {
  Write-Host "Slack notify failed: $_"
}
'''
        }
      }
    }
  } // stages

  post {
    success { echo "SUCCESS: ${env.IMAGE_TAG}" }
    failure { echo "FAILED" }
    always { echo "Pipeline finished: ${currentBuild.currentResult}" }
  }
}
