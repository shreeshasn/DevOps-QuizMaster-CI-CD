pipeline {
  agent any

  environment {
    // Image name base
    IMAGE_REPO = "shreeshasn/devops-quizmaster"
    // tag will be set dynamically from git short commit
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
          # Get short commit hash for tagging
          $sha = (git rev-parse --short HEAD).Trim()
          Write-Output "IMAGE_TAG = $sha"
          echo "##vso[task.setvariable variable=IMAGE_TAG]$sha"
        '''
      }
    }

    stage('Write .env.local (API key)') {
      steps {
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          powershell '''
            # create .env.local with the Vite key expected by your app
            $content = "VITE_API_KEY=$env:QUIZ_API_KEY"
            Set-Content -Path .env.local -Value $content -Force -Encoding UTF8
            Write-Output "Created .env.local"
          '''
        }
      }
    }

    stage('Install') {
      steps {
        powershell '''
          Write-Output "Node version:"
          node -v
          Write-Output "Running npm ci"
          npm ci
        '''
      }
    }

    stage('Build') {
      steps {
        powershell '''
          Write-Output "Building production assets"
          npm run build
        '''
      }
    }

    stage('Docker Build (local)') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          powershell '''
            $sha = "${env:IMAGE_TAG}"
            if (-not $sha) { $sha = (git rev-parse --short HEAD).Trim() }
            $imageTag = "${env:IMAGE_REPO}:$sha"
            Write-Output "Building local image: $imageTag"

            # Optional: set DOCKER_HOST if you use TCP daemon on 127.0.0.1:2375
            # $env:DOCKER_HOST = "tcp://127.0.0.1:2375"

            docker build -t $imageTag .
            Write-Output "Built: $imageTag"

            # Save tag for later stages
            Set-Content -Path .image_tag -Value $imageTag -Force
          '''
        }
      }
    }

    stage('Docker Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          powershell '''
            $imageTag = Get-Content -Path .image_tag
            if (-not $imageTag) { throw "image tag file missing" }

            Write-Output "Logging into Docker Hub"
            $pw = $env:DOCKER_PASS
            $user = $env:DOCKER_USER

            # Use docker login with stdin to avoid exposing password in logs
            $pw | docker login --username $user --password-stdin
            if ($LASTEXITCODE -ne 0) { throw "docker login failed" }

            Write-Output "Pushing $imageTag"
            docker push $imageTag
            if ($LASTEXITCODE -ne 0) { throw "docker push failed" }

            Write-Output "Docker push finished"
          '''
        }
      }
    }

    stage('Deploy to Kubernetes (optional)') {
      when {
        expression { fileExists('k8s/deployment.yaml') }
      }
      steps {
        // kubeconfig stored as "File" credential with id 'kubeconfig'
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF_PATH')]) {
          powershell '''
            $imageTag = Get-Content -Path .image_tag
            if (-not $imageTag) { throw "image tag file missing" }

            Write-Output "Using kubeconfig file at: $env:KUBECONF_PATH"
            $env:KUBECONFIG = $env:KUBECONF_PATH

            # If deployment exists, set image; otherwise apply manifest with placeholder replacement
            $dep = kubectl get deployment devops-quizmaster-deployment -o name 2>$null
            if ($dep) {
              Write-Output "Deployment exists — updating image"
              kubectl set image deployment/devops-quizmaster-deployment app=$imageTag --record
            } else {
              Write-Output "Applying k8s manifest with image replacement"
              (Get-Content k8s/deployment.yaml) -replace '__IMAGE_PLACEHOLDER__', $imageTag | kubectl apply -f -
            }

            # Optional: show rollout status
            kubectl rollout status deployment/devops-quizmaster-deployment
            kubectl get pods -l app=devops-quizmaster -o wide
            kubectl get svc devops-quizmaster-svc -o wide
          '''
        }
      }
    }
  }

  post {
    success {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          $body = @{ text = "Build & deploy succeeded: ${env.BUILD_URL}" } | ConvertTo-Json
          Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body $body
          Write-Output "Slack notified"
        '''
      }
    }
    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          $body = @{ text = "Build failed: ${env.BUILD_URL}" } | ConvertTo-Json
          Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body $body
          Write-Output "Slack notified of failure"
        '''
      }
    }
    always {
      // best-effort docker logout
      powershell '''
        try {
          docker logout
        } catch {
          Write-Output "docker logout failed or not logged in"
        }
      '''
    }
  }
}
