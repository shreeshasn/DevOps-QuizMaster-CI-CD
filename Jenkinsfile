pipeline {
  agent any

  options {
    // don't keep too many old builds
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timestamps()
  }

  stages {
    stage('Prepare') {
      steps {
        script {
          // short image tag from git commit
          def sha = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
          env.IMAGE_TAG = sha
          echo "IMAGE_TAG = ${env.IMAGE_TAG}"
        }
      }
    }

    stage('Tool checks (agent)') {
      steps {
        powershell '''
          Write-Output "whoami:"
          whoami
          Write-Output "git --version"; git --version
          Write-Output "node -v"; node -v
          Write-Output "npm -v"; npm -v
          Write-Output "docker --version"; docker --version
          Write-Output "kubectl version --client"; kubectl version --client
        '''
      }
    }

    stage('Write .env.local (API key)') {
      steps {
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          powershell '''
            $content = "VITE_API_KEY=${env:QUIZ_API_KEY}"
            Set-Content -Path .env.local -Value $content -Force -Encoding UTF8
            Write-Output ".env.local created"
          '''
        }
      }
    }

    stage('Install & Build') {
      steps {
        powershell '''
          Write-Output "Running npm ci"
          npm ci
          if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

          Write-Output "Running build"
          npm run build
          if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
        '''
      }
    }

    stage('Docker: build (local)') {
      steps {
        script {
          // dockerhub-creds must be username/password credentials
          withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
            powershell '''
              Write-Output "Building local docker image..."
              $tag = "shreeshasn/devops-quizmaster:${env:IMAGE_TAG}"
              Write-Output "Tag: $tag"
              docker build -t $tag .
              if ($LASTEXITCODE -ne 0) { throw "docker build failed" }
            '''
          }
        }
      }
    }

    stage('Docker: push (optional)') {
      when { expression { return params.PUSH_IMAGE == null || params.PUSH_IMAGE != 'false' } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          powershell '''
            $tag = "shreeshasn/devops-quizmaster:${env:IMAGE_TAG}"
            Write-Output "Logging into Docker Hub..."
            $pw = ${env:DOCKER_PASS}
            # use password-stdin to avoid inline secrets - Powershell piping:
            $pw | docker login --username ${env:DOCKER_USER} --password-stdin
            if ($LASTEXITCODE -ne 0) { throw "docker login failed" }

            Write-Output "Pushing $tag..."
            docker push $tag
            if ($LASTEXITCODE -ne 0) { throw "docker push failed" }

            Write-Output "Docker push done."
            docker logout
          '''
        }
      }
    }

    stage('Optional: Deploy to Kubernetes') {
      steps {
        script {
          // If kubeconfig file credential is available, deploy
          // This uses a file credential with id 'kubeconfig'
          try {
            withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
              powershell '''
                Write-Output "Using KUBECONFIG from Jenkins file credential"
                $env:KUBECONFIG = "${env:KUBECONF}"
                kubectl get nodes --no-headers -o wide
                # Replace image in existing deployment or apply manifest with replaced image placeholder
                $image = "shreeshasn/devops-quizmaster:${env:IMAGE_TAG}"
                if (kubectl get deployment devops-quizmaster-deployment -o name) {
                  kubectl set image deployment/devops-quizmaster-deployment app=$image --record
                  kubectl rollout status deployment/devops-quizmaster-deployment
                } else {
                  (Get-Content k8s/deployment.yaml) -replace "__IMAGE_PLACEHOLDER__", $image | kubectl apply -f -
                  kubectl apply -f k8s/service.yaml
                }
              '''
            }
          } catch (err) {
            echo "kubeconfig credential not present or kubectl failed; skipping k8s deploy. (${err})"
          }
        }
      }
    }

    stage('Notify Slack (optional)') {
      steps {
        withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
          powershell '''
            $body = @{ text = "Jenkins: build ${env.BUILD_NUMBER} finished. See console for details." } | ConvertTo-Json
            try {
              Invoke-RestMethod -Uri ${env:SLACK_WEBHOOK} -Method Post -ContentType 'application/json' -Body $body
              Write-Output "Slack notified."
            } catch {
              Write-Output "Slack notify failed: $_"
            }
          '''
        }
      }
    }
  }

  post {
    always {
      powershell '''
        Write-Output "Post-build cleanup: try docker logout (safe)"
        try {
          docker logout
        } catch {
          Write-Output "docker logout error (ignored)"
        }
      '''
    }
    success {
      echo "Pipeline succeeded."
    }
    failure {
      echo "Pipeline failed. Check console output."
    }
  }
}
