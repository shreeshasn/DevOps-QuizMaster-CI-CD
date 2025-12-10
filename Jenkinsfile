// Jenkinsfile - Windows-only, PowerShell steps, minimal
pipeline {
  agent { label 'windows' }

  environment {
    DOCKER_REPO = "shreeshasn/devops-quizmaster"
    // CI will set IMAGE_TAG after checkout
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
# write short git sha to file and read it
git rev-parse --short HEAD > .gitsha
$git = Get-Content .gitsha -Raw
$env:IMAGE_TAG = "${env:DOCKER_REPO}:${env.BRANCH_NAME}-$git".Trim()
Write-Host "IMAGE_TAG = $env:IMAGE_TAG"
'''
      }
    }

    stage('Install: set API key & npm ci') {
      steps {
        // credential id 'quiz-api-key' must exist (Secret text)
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          powershell '''
# create .env.local for Vite with API key
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
        powershell '''
npm run build
'''
      }
    }

    stage('Docker: build') {
      steps {
        powershell '''
# If using Docker Desktop with remote API on 127.0.0.1:2375 set DOCKER_HOST; otherwise ensure Docker daemon accessible
setx DOCKER_HOST "tcp://127.0.0.1:2375" > $null 2>&1 || Write-Host "setx may require restart - continuing"
docker build -t $env:IMAGE_TAG .
docker images --filter=reference=$env:IMAGE_TAG
'''
      }
    }

    stage('Docker: push') {
      steps {
        // dockerhub username/password as credentials (update IDs in Jenkins)
        withCredentials([
          string(credentialsId: 'dockerhub-username', variable: 'DOCKER_USER'),
          string(credentialsId: 'dockerhub-password', variable: 'DOCKER_PASS')
        ]) {
          powershell '''
# Login and push
$pw = $env:DOCKER_PASS
# echo password to docker login (PowerShell)
$bytes = [System.Text.Encoding]::UTF8.GetBytes($pw + "`n")
$ms = New-Object System.IO.MemoryStream(,$bytes)
# Use plain docker login if available; fallback to echo
echo $pw | docker login -u $env:DOCKER_USER --password-stdin
docker push $env:IMAGE_TAG
docker logout || Write-Host "docker logout failed but continuing"
'''
        }
      }
    }

    stage('Optional: Deploy to K8s (if kubeconfig credential exists)') {
      when {
        expression { return fileExists('k8s/deployment.yaml') }
      }
      steps {
        // 'kubeconfig' is stored in Jenkins as a secret file credential
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
          powershell '''
# point kubectl to provided kubeconfig
$env:KUBECONFIG = "${env:KUBECONF}"
$img = $env:IMAGE_TAG

# If deployment exists, update image; else apply manifest with replacement
if (kubectl get deployment devops-quizmaster-deployment -o name 2>$null) {
  kubectl set image deployment/devops-quizmaster-deployment app=$img --record
  kubectl rollout status deployment/devops-quizmaster-deployment --timeout=120s
} else {
  (Get-Content .\\k8s\\deployment.yaml) -replace '__IMAGE_PLACEHOLDER__', $img | kubectl apply -f -
  kubectl rollout status deployment/devops-quizmaster-deployment --timeout=120s
}
'''
        }
      }
    }
  } // stages

  post {
    always {
      // slack-webhook as secret text
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
    success { echo "SUCCESS: image ${env.IMAGE_TAG}" }
    failure { echo "FAILED" }
  }
}
