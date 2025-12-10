pipeline {
  agent any

  parameters {
    string(name: 'PUSH_IMAGE', defaultValue: 'true', description: 'Set to "false" to skip pushing image')
  }

  options {
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timestamps()
  }

  stages {
    stage('Prepare') {
      steps {
        powershell(script: '''
          Write-Output "Setting IMAGE_TAG from git"
          $sha = (git rev-parse --short HEAD).Trim()
          if (-not $sha) { throw "git rev-parse failed or git not available" }
          Write-Output "SHA = $sha"
          # export for later stages
          Write-Output ("##vso[task.setvariable variable=IMAGE_TAG]" + $sha)
          Set-Content -Path .pipeline_image_tag -Value $sha -Force -Encoding UTF8
        ''')
      }
    }

    stage('Agent tool checks') {
      steps {
        powershell '''
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
          Write-Output "Installing dependencies (npm ci)..."
          npm ci
          if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }

          Write-Output "Building production assets (npm run build)..."
          npm run build
          if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE" }
        '''
      }
    }

    stage('Docker: build (local)') {
      steps {
        powershell(script: '''
          $sha = Get-Content .pipeline_image_tag
          $image = "shreeshasn/devops-quizmaster:$sha"
          Write-Output "Building image: $image"
          docker build -t $image .
          if ($LASTEXITCODE -ne 0) { throw "docker build failed" }
          Write-Output "Built $image"
        ''')
      }
    }

    stage('Docker: push (optional)') {
      when { expression { return params.PUSH_IMAGE?.toLowerCase() != 'false' } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          powershell '''
            $sha = Get-Content .pipeline_image_tag
            $image = "shreeshasn/devops-quizmaster:$sha"
            Write-Output "Logging in to Docker Hub as $env:DOCKER_USER"
            # Use password-stdin pattern
            $pw = $env:DOCKER_PASS
            $pw | docker login --username $env:DOCKER_USER --password-stdin
            if ($LASTEXITCODE -ne 0) { throw "docker login failed" }

            Write-Output "Pushing image $image"
            docker push $image
            if ($LASTEXITCODE -ne 0) { throw "docker push failed" }

            Write-Output "Logout docker"
            docker logout
          '''
        }
      }
    }

    stage('Optional: Deploy to Kubernetes') {
      steps {
        script {
          try {
            withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF_PATH')]) {
              powershell '''
                Write-Output "Using KUBECONFIG from file credential"
                $env:KUBECONFIG = "${env:KUBECONF_PATH}"
                kubectl get nodes --no-headers || throw "kubectl get nodes failed"

                $sha = Get-Content .pipeline_image_tag
                $image = "shreeshasn/devops-quizmaster:$sha"

                if (kubectl get deployment devops-quizmaster-deployment -o name) {
                  kubectl set image deployment/devops-quizmaster-deployment app=$image --record
                  kubectl rollout status deployment/devops-quizmaster-deployment
                } else {
                  (Get-Content k8s/deployment.yaml) -replace "__IMAGE_PLACEHOLDER__", $image | kubectl apply -f -
                  kubectl apply -f k8s/service.yaml
                }
              '''
            }
          } catch (exc) {
            echo "Kubernetes deploy skipped (kubeconfig missing or error): ${exc}"
          }
        }
      }
    }

    stage('Notify Slack (optional)') {
      steps {
        withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
          powershell '''
            $body = @{ text = "Jenkins build ${env:BUILD_NUMBER} for ${env:JOB_NAME} finished. See console." } | ConvertTo-Json
            try {
              Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body $body
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
        Write-Output "Post: attempt docker logout (safe)"
        try { docker logout } catch { Write-Output "docker logout ignored" }
      '''
    }
    success { echo "Pipeline succeeded." }
    failure { echo "Pipeline failed. Inspect console log." }
  }
}
