pipeline {
  agent any

  environment {
    APP_NAME   = 'devops-quizmaster'
    DOCKER_REPO = 'shreeshasn/devops-quizmaster'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Create .env.local from Jenkins secret') {
      steps {
        // quiz-api-key: Secret text credential in Jenkins
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          powershell '''
            Write-Output "Writing .env.local"
            $value = "VITE_API_KEY=$env:QUIZ_API_KEY"
            Set-Content -Path .env.local -Value $value -Force
            Write-Output ".env.local contents:"
            Get-Content .env.local
          '''
        }
      }
    }

    stage('Install dependencies') {
      steps {
        powershell '''
          Write-Output "Check node"
          try {
            $nv = & node -v 2>&1
            if ($LASTEXITCODE -ne 0) {
              Write-Output "node not found or returned non-zero exit code: $nv"
              exit 1
            } else {
              Write-Output "Node version: $nv"
            }
          } catch {
            Write-Output "node command failed: $_"
            exit 1
          }
          Write-Output "Running npm ci..."
          npm ci
        '''
      }
    }

    stage('Build') {
      steps {
        powershell '''
          Write-Output "Running build..."
          npm run build
        '''
      }
    }

    stage('Docker Build & Push') {
      steps {
        // dockerhub-creds: Username with password credential in Jenkins
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
          powershell '''
            Write-Output "Determining git tag..."
            $tag = (git rev-parse --short HEAD 2>$null).Trim()
            if (-not $tag) { $tag = "local-latest" }
            $image = "$env:DOCKER_REPO:$tag"
            Write-Output "Image will be: $image"

            Write-Output "Logging into Docker Hub..."
            # Use password via stdin (PowerShell piping works)
            $env:DOCKERHUB_PASS | docker login -u $env:DOCKERHUB_USER --password-stdin

            Write-Output "Building docker image..."
            docker build -t $image .

            Write-Output "Pushing docker image..."
            docker push $image

            Write-Output "Saving tag to .image_tag"
            Set-Content -Path .image_tag -Value $tag -Force
          '''
        }
      }
    }

    stage('Optional: Deploy to Kubernetes') {
      when {
        allOf {
          expression { fileExists('k8s/deployment.yaml') }
          expression { credentialsExists('kubeconfig') } // custom helper below
        }
      }
      steps {
        // kubeconfig: Secret file credential id 'kubeconfig'
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
          powershell '''
            # use provided kubeconfig file
            $env:KUBECONFIG = $env:KUBECONF

            $tag = ""
            if (Test-Path .image_tag) { $tag = (Get-Content .image_tag).Trim() }
            if (-not $tag) { $tag = (git rev-parse --short HEAD 2>$null).Trim() }
            if (-not $tag) { Write-Error "Cannot determine image tag"; exit 1 }

            $image = "$env:DOCKER_REPO:$tag"
            Write-Output "Deploying image: $image"

            # if deployment exists, update image; otherwise replace placeholder and apply
            $exists = (kubectl get deployment $env:APP_NAME-deployment -o name 2>$null).Trim()
            if ($exists) {
              Write-Output "Deployment exists - updating image"
              kubectl set image deployment/$env:APP_NAME-deployment app=$image --record
            } else {
              Write-Output "Creating deployment from manifest (replacing placeholder)"
              $manifest = Get-Content k8s/deployment.yaml -Raw
              $manifest = $manifest -replace '__IMAGE_PLACEHOLDER__', $image
              $manifest | kubectl apply -f -
            }

            Write-Output "Waiting for rollout..."
            kubectl rollout status deployment/$env:APP_NAME-deployment
          '''
        }
      }
    }
  }

  post {
    success {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          try {
            $payload = @{ text = "SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}" } | ConvertTo-Json
            Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body $payload
            Write-Output "Slack notified of success."
          } catch {
            Write-Output "Slack notify failed: $_"
          }
        '''
      }
    }

    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          try {
            $payload = @{ text = "FAILURE: ${env.JOB_NAME} #${env.BUILD_NUMBER}" } | ConvertTo-Json
            Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body $payload
            Write-Output "Slack notified of failure."
          } catch {
            Write-Output "Slack notify failed: $_"
          }
        '''
      }
    }

    always {
      powershell '''
        Write-Output "Attempting docker logout (safe)..."
        try {
          docker logout
        } catch {
          Write-Output "docker logout failed or was not logged in"
        }
      '''
    }
  }
}

// Utility function used in when{} (Groovy side). This avoids failing pipeline if kubeconfig missing.
def credentialsExists(String id) {
  try {
    return com.cloudbees.plugins.credentials.CredentialsProvider.lookupCredentials(
      com.cloudbees.plugins.credentials.common.StandardCredentials.class,
      Jenkins.instance,
      null,
      null
    ).any { it.id == id }
  } catch (e) {
    // if lookup fails, prefer false to avoid breaking pipeline parse
    return false
  }
}
