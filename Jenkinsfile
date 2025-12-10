pipeline {
  agent any

  environment {
    // these are placeholders for readability; actual secret values come from withCredentials blocks
    APP_NAME = "devops-quizmaster"
    DOCKER_REPO = "shreeshasn/devops-quizmaster"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Set API key (.env.local)') {
      steps {
        // quiz-api-key must be a Secret Text credential in Jenkins
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          powershell '''
            Write-Output "Creating .env.local with VITE_API_KEY from Jenkins credential..."
            # Ensure file overwritten each run
            Set-Content -Path .env.local -Value "VITE_API_KEY=$env:QUIZ_API_KEY" -Force
            Write-Output ".env.local created."
            Get-Content .env.local
          '''
        }
      }
    }

    stage('Install') {
      steps {
        powershell '''
          Write-Output "Node version:"
          node -v || Write-Output "node not found"
          Write-Output "Installing dependencies..."
          npm ci
        '''
      }
    }

    stage('Build') {
      steps {
        powershell '''
          Write-Output "Building production assets..."
          npm run build
        '''
      }
    }

    stage('Docker Build & Push') {
      steps {
        // dockerhub-creds must be a username/password credential in Jenkins
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
          powershell '''
            # compute image tag from current git short SHA
            $tag = (git rev-parse --short HEAD).Trim()
            if (-not $tag) { $tag = "local-latest" }
            $image = "$env:DOCKER_REPO:$tag"
            Write-Output "Building docker image: $image"

            # Login to DockerHub
            $securePass = $env:DOCKERHUB_PASS
            # echo password into docker login --password-stdin
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($securePass + "`n")
            $ms = New-Object System.IO.MemoryStream(,$bytes)
            $ms.Position = 0
            $stream = [System.Console]::OpenStandardInput()
            # Use here-string approach with docker login --password-stdin
            Write-Output "Logging into Docker Hub..."
            echo $securePass | docker login -u $env:DOCKERHUB_USER --password-stdin

            # Build & push
            docker build -t $image .
            Write-Output "Pushing image $image"
            docker push $image

            # persist tag to a file for optional deploy usage later
            Set-Content -Path .image_tag -Value $tag -Force
            Write-Output "Image pushed and .image_tag written ($tag)"
          '''
        }
      }
    }

    stage('Optional: Deploy to Kubernetes') {
      when {
        expression {
          // Only try deploy if kubeconfig credential exists - change this flag if you always want it
          return fileExists('k8s/deployment.yaml') && (env.KUBECONF_CRED_ID != null)
        }
      }
      steps {
        // kubeconfig must be stored as a Secret file credential with id 'kubeconfig'
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
          powershell '''
            # point kubectl to the provided kubeconfig file
            $env:KUBECONFIG = $env:KUBECONF
            $tag = (Get-Content .image_tag -ErrorAction SilentlyContinue) -as [string]
            if (-not $tag) { $tag = (git rev-parse --short HEAD).Trim() }
            if (-not $tag) { Write-Error "Cannot determine image tag, aborting deploy"; exit 1 }
            $image = "$env:DOCKER_REPO:$tag"
            Write-Output "Deploying image $image to Kubernetes (kubeconfig provided)."

            # If deployment exists, update image; otherwise apply manifest after replacing placeholder
            $exists = (kubectl get deployment $env:APP_NAME-deployment -o name 2>$null).Trim()
            if ($exists) {
              Write-Output "Updating existing deployment image..."
              kubectl set image deployment/$env:APP_NAME-deployment app=$image --record
            } else {
              Write-Output "Applying new manifest with image replacement..."
              (Get-Content k8s/deployment.yaml) -replace "__IMAGE_PLACEHOLDER__", $image | kubectl apply -f -
            }

            # roll-out status
            kubectl rollout status deployment/$env:APP_NAME-deployment
            Write-Output "Deploy step finished."
          '''
        }
      }
    }
  }

  post {
    success {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          $body = @{ text = "Pipeline SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}" } | ConvertTo-Json
          Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body $body
          Write-Output "Slack notified of success."
        '''
      }
    }
    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          $body = @{ text = "Pipeline FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}" } | ConvertTo-Json
          Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body $body
          Write-Output "Slack notified of failure."
        '''
      }
    }
    always {
      powershell '''
        Write-Output "Cleaning up docker login (logout) if present..."
        try {
          docker logout
        } catch {
          Write-Output "docker logout failed or not logged in"
        }
      '''
    }
  }
}
