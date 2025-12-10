pipeline {
  agent any

  environment {
    APP_NAME    = 'devops-quizmaster'
    DOCKER_REPO = 'shreeshasn/devops-quizmaster' // change if needed
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Write .env.local (API key)') {
      steps {
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          powershell '''
            Write-Output "Creating .env.local"
            $line = "VITE_API_KEY=$env:QUIZ_API_KEY"
            Set-Content -Path .env.local -Value $line -Force
            Get-Content .env.local
          '''
        }
      }
    }

    stage('Install') {
      steps {
        powershell '''
          Write-Output "Node check..."
          try {
            $v = node -v 2>$null
            if ($LASTEXITCODE -ne 0) { throw "node not found" }
            Write-Output "Node version: $v"
          } catch { Write-Error $_; exit 1 }
          Write-Output "npm ci"
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

    stage('Build Docker image (local)') {
      steps {
        powershell '''
          $tag = (git rev-parse --short HEAD 2>$null).Trim()
          if (-not $tag) { $tag = "local-latest" }
          $image = "${env:DOCKER_REPO}:$tag"
          Write-Output "Building local image: $image"
          docker build -t $image .
          Set-Content -Path .image_tag -Value $tag -Force
          Write-Output "Built: $image"
        '''
      }
    }

    stage('Push Image (try)') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
          powershell '''
            $tag = Get-Content .image_tag -ErrorAction SilentlyContinue
            if (-not $tag) { $tag = (git rev-parse --short HEAD 2>$null).Trim() }
            $image = "${env:DOCKER_REPO}:$tag"
            Write-Output "Attempting docker login..."
            $pw = $env:DOCKERHUB_PASS
            try {
              $pw | docker login -u $env:DOCKERHUB_USER --password-stdin
              Write-Output "Docker login succeeded."
            } catch {
              Write-Warning "Docker login failed: $_"
              Write-Warning "Skipping push, proceeding with local image."
              exit 0
            }
            # If docker daemon not exposed via TCP, we still can push if docker engine available locally
            try {
              docker push $image
              Write-Output "Pushed $image"
            } catch {
              Write-Warning "Docker push failed: $_"
              Write-Warning "Proceeding with local image for local Kubernetes (no push)."
            }
          '''
        }
      }
    }

    stage('Deploy to Kubernetes (optional)') {
      when {
        expression { fileExists('k8s/deployment.yaml') }
      }
      steps {
        // if you have a kubeconfig credential, use it; otherwise assume kubectl on agent already points to Docker Desktop
        script {
          def useKubeCred = false
          try {
            useKubeCred = com.cloudbees.plugins.credentials.CredentialsProvider.lookupCredentials(
              com.cloudbees.plugins.credentials.common.StandardCredentials.class, Jenkins.instance, null, null
            ).any { it.id == 'kubeconfig' }
          } catch(e) { useKubeCred = false }
          if (useKubeCred) {
            withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
              powershell '''
                $env:KUBECONFIG = $env:KUBECONF
                $tag = Get-Content .image_tag
                $image = "${env:DOCKER_REPO}:$tag"
                $exists = (kubectl get deployment ${env:APP_NAME}-deployment -o name 2>$null).Trim()
                if ($exists) {
                  kubectl set image deployment/${env:APP_NAME}-deployment app=$image --record
                } else {
                  $manifest = Get-Content k8s/deployment.yaml -Raw
                  $manifest = $manifest -replace '__IMAGE_PLACEHOLDER__', $image
                  $manifest | kubectl apply -f -
                }
                kubectl rollout status deployment/${env:APP_NAME}-deployment
              '''
            }
          } else {
            powershell '''
              Write-Output "No kubeconfig credential; assuming kubectl already points to desired local cluster."
              $tag = Get-Content .image_tag
              $image = "${env:DOCKER_REPO}:$tag"
              $exists = (kubectl get deployment ${env:APP_NAME}-deployment -o name 2>$null).Trim()
              if ($exists) {
                kubectl set image deployment/${env:APP_NAME}-deployment app=$image --record
              } else {
                $manifest = Get-Content k8s/deployment.yaml -Raw
                $manifest = $manifest -replace '__IMAGE_PLACEHOLDER__', $image
                $manifest | kubectl apply -f -
              }
              kubectl rollout status deployment/${env:APP_NAME}-deployment
            '''
          }
        }
      }
    }
  }

  post {
    always {
      powershell '''
        try { docker logout } catch { Write-Output "docker logout safe: ignored" }
      '''
    }
    success {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          try {
            $payload = @{ text = "SUCCESS: ${env:JOB_NAME} #${env:BUILD_NUMBER}" } | ConvertTo-Json
            Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body $payload
          } catch { Write-Output "Slack notify failed: $_" }
        '''
      }
    }
    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          try {
            $payload = @{ text = "FAILURE: ${env:JOB_NAME} #${env:BUILD_NUMBER}" } | ConvertTo-Json
            Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body $payload
          } catch { Write-Output "Slack notify failed: $_" }
        '''
      }
    }
  }
}
