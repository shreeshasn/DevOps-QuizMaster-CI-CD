pipeline {
  agent any

  parameters {
    booleanParam(name: 'PUSH_TO_DOCKERHUB', defaultValue: false, description: 'Push built image to Docker Hub')
    booleanParam(name: 'DEPLOY_TO_K8S', defaultValue: false, description: 'Deploy to Kubernetes after build')
  }

  environment {
    IMAGE_REPO = "shreeshasn/devops-quizmaster"
    IMAGE_TAG  = ""   // will be set in Prepare stage
  }

  stages {
    stage('Prepare') {
      steps {
        script {
          // run powershell and capture stdout; trim newlines
          def sha = powershell(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
          if (!sha) { sha = "local" }
          env.IMAGE_TAG = sha
          echo "Using IMAGE_TAG = ${env.IMAGE_TAG}"
        }
      }
    }

    stage('Write .env.local (API key)') {
      steps {
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          powershell '''
            "VITE_API_KEY=$env:QUIZ_API_KEY" | Out-File -FilePath .env.local -Encoding ascii
            Write-Output ".env.local created"
          '''
        }
      }
    }

    stage('Install & Build') {
      steps {
        powershell '''
          Write-Output "Node version: $(node -v)"
          Write-Output "NPM version: $(npm -v)"
          Write-Output "Running npm ci"
          npm ci
          if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

          Write-Output "Running npm run build"
          npm run build
          if ($LASTEXITCODE -ne 0) { throw "npm build failed" }
        '''
      }
    }

    stage('Docker: build (local)') {
      steps {
        powershell '''
          $tag = "${env:IMAGE_REPO}:${env:IMAGE_TAG}"
          Write-Output "Building image: $tag"
          docker build -t $tag .
          if ($LASTEXITCODE -ne 0) { throw "docker build failed" }
          Write-Output "Built: $tag"
        '''
      }
    }

    stage('Docker: push (optional)') {
      when {
        expression { return params.PUSH_TO_DOCKERHUB == true }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
          powershell '''
            $user = $env:DOCKERHUB_USER
            $pass = $env:DOCKERHUB_PASS
            Write-Output "Logging in to Docker Hub as $user"
            $pass | docker login --username $user --password-stdin
            if ($LASTEXITCODE -ne 0) { throw "docker login failed" }

            $tag = "${env:IMAGE_REPO}:${env:IMAGE_TAG}"
            Write-Output "Pushing $tag"
            docker push $tag
            if ($LASTEXITCODE -ne 0) { throw "docker push failed" }
          '''
        }
      }
    }

    stage('Optional: Deploy to Kubernetes') {
      when {
        anyOf {
          expression { return params.DEPLOY_TO_K8S == true }
          expression { return fileExists('k8s') }
        }
      }
      steps {
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG_FILE')]) {
          powershell '''
            Write-Output "Using kubeconfig file: $env:KUBECONFIG_FILE"
            $env:KUBECONFIG = $env:KUBECONFIG_FILE

            if (Test-Path "k8s") {
              Write-Output "Applying manifests from k8s/"
              kubectl apply -f k8s
              if ($LASTEXITCODE -ne 0) { throw "kubectl apply failed" }
            } else {
              Write-Output "No k8s/ folder found; skipping manifests"
            }

            # Try to set NodePort 30080 for expected service name (adjust if your svc name differs)
            $svc = "devops-quizmaster-svc"
            $svcExists = & kubectl get svc $svc -o name 2>$null
            if ($LASTEXITCODE -eq 0) {
              Write-Output "Patching service $svc to NodePort 30080 (if needed)"
              kubectl patch svc $svc -p '{"spec":{"type":"NodePort"}}' --type=merge
              kubectl patch svc $svc -p '{"spec":{"ports":[{"port":80,"nodePort":30080,"protocol":"TCP"}]}}' --type=merge
            } else {
              Write-Output "Service $svc not present - skip service patch"
            }

            Write-Output "Kubernetes deploy finished"
          '''
        }
      }
    }
  }

  post {
    success {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          $msg = @{ text = "Build SUCCESS: $env:JOB_NAME #$env:BUILD_NUMBER - ${env:IMAGE_REPO}:${env:IMAGE_TAG}" } | ConvertTo-Json
          try { Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -Body $msg -ContentType "application/json"; Write-Output "Slack notified success" } catch { Write-Output "Slack notify failed: $_" }
        '''
      }
    }

    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          $msg = @{ text = "Build FAILED: $env:JOB_NAME #$env:BUILD_NUMBER" } | ConvertTo-Json
          try { Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -Body $msg -ContentType "application/json"; Write-Output "Slack notified failure" } catch { Write-Output "Slack notify failed: $_" }
        '''
      }
    }

    always {
      powershell '''
        Write-Output "Attempt docker logout (safe)"
        try { docker logout } catch { Write-Output "docker logout not needed or failed" }
      '''
    }
  }
}
