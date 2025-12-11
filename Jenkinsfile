pipeline {
  agent any

  environment {
    IMAGE_REPO = "shreeshasn/devops-quizmaster"
    IMAGE_TAG  = ""   // populated in Prepare stage
  }

  stages {
    stage('Prepare') {
      steps {
        powershell '''
          Write-Output "Setting IMAGE_TAG from git"
          $sha = (git rev-parse --short HEAD).Trim()
          if (-not $sha) { $sha = "local" }
          $env:IMAGE_TAG = $sha
          Write-Output "IMAGE_TAG = $env:IMAGE_TAG"
        '''
      }
    }

    stage('Write .env.local (API key)') {
      steps {
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          powershell '''
            Write-Output ".env.local created"
            "VITE_API_KEY=$env:QUIZ_API_KEY" | Out-File -FilePath .env.local -Encoding ascii
          '''
        }
      }
    }

    stage('Install & Build') {
      steps {
        powershell '''
          Write-Output "Node version: $(node -v)"
          Write-Output "NPM version: $(npm -v)"
          Write-Output "Installing dependencies (npm ci)"
          npm ci
          if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

          Write-Output "Building production assets (npm run build)"
          npm run build
          if ($LASTEXITCODE -ne 0) { throw "npm build failed" }
        '''
      }
    }

    stage('Docker: build (local)') {
      steps {
        powershell '''
          $tag = "$env:IMAGE_REPO:$env:IMAGE_TAG"
          Write-Output "Building image: $tag"
          docker build -t $tag .
          if ($LASTEXITCODE -ne 0) { throw "docker build failed" }
        '''
      }
    }

    stage('Docker: push (optional)') {
      when {
        expression { return (params.PUSH_TO_DOCKERHUB ? true : false) }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
          powershell '''
            $user = $env:DOCKERHUB_USER
            $pass = $env:DOCKERHUB_PASS
            Write-Output "Logging in to Docker Hub as $user"
            $pass | docker login --username $user --password-stdin
            if ($LASTEXITCODE -ne 0) { throw "docker login failed" }

            $tag = "$env:IMAGE_REPO:$env:IMAGE_TAG"
            Write-Output "Pushing $tag"
            docker push $tag
            if ($LASTEXITCODE -ne 0) { throw "docker push failed" }
          '''
        }
      }
    }

    stage('Optional: Deploy to Kubernetes') {
      when {
        expression { return (fileExists('k8s') -or params.DEPLOY_TO_K8S) }
      }
      steps {
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG_FILE')]) {
          powershell '''
            Write-Output "Using kubeconfig at $env:KUBECONFIG_FILE"
            $env:KUBECONFIG = $env:KUBECONFIG_FILE

            # apply manifests if you have them under k8s/
            if (Test-Path k8s) {
              kubectl apply -f k8s
              if ($LASTEXITCODE -ne 0) { throw "kubectl apply failed" }
            }

            # ensure service is NodePort on port 30080 (adjust names if needed)
            $svc = "devops-quizmaster-svc"
            if ((kubectl get svc $svc -o name) -ne $null) {
              Write-Output "Patching service $svc to nodePort 30080 (if not already)"
              kubectl patch svc $svc -p '{"spec":{"type":"NodePort"}}' --type=merge
              kubectl patch svc $svc -p '{"spec":{"ports":[{"port":80,"nodePort":30080,"protocol":"TCP"}]}}' --type=merge
            } else {
              Write-Output "Service $svc not found. Create one or check k8s manifests."
            }

            Write-Output "Deployment/Service applied. Use kubectl get pods,svc to check."
          '''
        }
      }
    }
  }

  post {
    success {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          $msg = @{ text = "Build SUCCESS: $env:JOB_NAME #$env:BUILD_NUMBER - $env:IMAGE_REPO:$env:IMAGE_TAG" } | ConvertTo-Json
          $web = $env:SLACK_WEBHOOK
          $response = Invoke-RestMethod -Uri $web -Method Post -Body $msg -ContentType "application/json"
          Write-Output "Slack notified success"
        '''
      }
    }
    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          $msg = @{ text = "Build FAILED: $env:JOB_NAME #$env:BUILD_NUMBER" } | ConvertTo-Json
          $web = $env:SLACK_WEBHOOK
          try { Invoke-RestMethod -Uri $web -Method Post -Body $msg -ContentType "application/json" } catch { Write-Output "Slack notify failed: $_" }
        '''
      }
    }
    always {
      powershell '''
        Write-Output "Post: attempt docker logout (safe)"
        try {
          docker logout 2>$null
        } catch {
          Write-Output "docker logout failed or not logged in"
        }
      '''
    }
  }
}