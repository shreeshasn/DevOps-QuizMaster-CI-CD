pipeline {
  agent any

  parameters {
    booleanParam(name: 'PUSH_TO_DOCKERHUB', defaultValue: false, description: 'Push built image to Docker Hub')
    booleanParam(name: 'DEPLOY_TO_K8S', defaultValue: false, description: 'Deploy to Kubernetes after build')
  }

  environment {
    IMAGE_REPO = "shreeshasn/devops-quizmaster"
    IMAGE_TAG  = "" // computed in Prepare
  }

  stages {
    stage('Prepare') {
      steps {
        script {
          // Try env.GIT_COMMIT first (set by checkout), then try git command, else fallback to BUILD_NUMBER.
          def candidate = env.GIT_COMMIT
          if (!candidate) {
            echo "env.GIT_COMMIT not set; trying git rev-parse"
            try {
              def out = powershell(returnStdout: true, script: 'git rev-parse --short HEAD 2>$null').trim()
              if (out) { candidate = out }
            } catch (e) {
              echo "git rev-parse attempt failed: ${e}"
            }
          } else {
            echo "env.GIT_COMMIT found"
          }

          if (!candidate) {
            echo "Could not determine git SHA; falling back to BUILD_NUMBER"
            candidate = env.BUILD_NUMBER ?: "local"
          }

          // safe short tag (if full commit was provided, shorten to 8 chars)
          if (candidate.length() > 8) { candidate = candidate.substring(0,8) }

          env.IMAGE_TAG = candidate
          echo "Computed IMAGE_TAG = ${env.IMAGE_TAG}"
        }
      }
    }

    stage('Write .env.local (API key)') {
      steps {
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          powershell '''
            $line = "VITE_API_KEY=$env:QUIZ_API_KEY"
            $line | Out-File -FilePath .env.local -Encoding ascii
            Write-Output ".env.local created"
          '''
        }
      }
    }

    stage('Install & Build') {
      steps {
        powershell '''
          Write-Output "Node: $(node -v)"
          Write-Output "NPM: $(npm -v)"
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
        script {
          if (!env.IMAGE_TAG) {
            error "IMAGE_TAG is empty; aborting docker build"
          }
        }
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
            Write-Output "Logging in to Docker Hub as $env:DOCKERHUB_USER"
            $env:DOCKERHUB_PASS | docker login --username $env:DOCKERHUB_USER --password-stdin
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
        expression { return params.DEPLOY_TO_K8S == true || fileExists('k8s') }
      }
      steps {
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG_FILE')]) {
          powershell '''
            Write-Output "Using kubeconfig file at $env:KUBECONFIG_FILE"
            $env:KUBECONFIG = $env:KUBECONFIG_FILE

            if (Test-Path "k8s") {
              Write-Output "Applying manifests in k8s/"
              kubectl apply -f k8s
              if ($LASTEXITCODE -ne 0) { throw "kubectl apply failed" }
            } else {
              Write-Output "No k8s directory; skipping apply"
            }

            # Try to expose service nodePort 30080 for demo (adjust svc name if needed)
            $svc = "devops-quizmaster-svc"
            $svcOut = kubectl get svc $svc --ignore-not-found -o json 2>$null
            if ($LASTEXITCODE -eq 0 -and $svcOut) {
              Write-Output "Patching $svc to NodePort 30080"
              kubectl patch svc $svc -p '{"spec":{"type":"NodePort"}}' --type=merge
              kubectl patch svc $svc -p '{"spec":{"ports":[{"port":80,"nodePort":30080,"protocol":"TCP"}]}}' --type=merge
            } else {
              Write-Output "Service $svc not found; skipping patch"
            }
          '''
        }
      }
    }
  }

  post {
    success {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          $msg = @{ text = "SUCCESS: $env:JOB_NAME #$env:BUILD_NUMBER -> ${env:IMAGE_REPO}:${env:IMAGE_TAG}" } | ConvertTo-Json
          try { Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -Body $msg -ContentType "application/json"; Write-Output "Slack notified success" } catch { Write-Output "Slack notify failed: $_" }
        '''
      }
    }

    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell '''
          $msg = @{ text = "FAILURE: $env:JOB_NAME #$env:BUILD_NUMBER" } | ConvertTo-Json
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
