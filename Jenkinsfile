pipeline {
  agent any

  options {
    timeout(time: 30, unit: 'MINUTES')
    timestamps()
  }

  environment {
    // Optional: uncomment or change if you need Docker daemon via TCP
    // DOCKER_HOST = 'tcp://127.0.0.1:2375'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Prepare') {
      steps {
        script {
          // Get short commit
          def sha = bat(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
          // safe fallback
          if (!sha) { sha = 'local' }
          env.IMAGE_TAG = sha
          echo "IMAGE_TAG = ${env.IMAGE_TAG}"
        }
      }
    }

    stage('Write .env.local (API key)') {
      steps {
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          powershell(script: """
            $content = "VITE_API_KEY=$env:QUIZ_API_KEY"
            Set-Content -Path .env.local -Value $content -Force -Encoding UTF8
            Write-Output "Created .env.local"
          """)
        }
      }
    }

    stage('Install') {
      steps {
        powershell label: 'Install dependencies', script: '''
          Write-Output "Node version:"
          node -v
          # Use npm ci for CI reproducible installs; if you prefer npm install, change this line
          npm ci
        '''
      }
    }

    stage('Build') {
      steps {
        powershell label: 'Build production assets', script: '''
          npm run build
        '''
      }
    }

    stage('Docker Build & Push') {
      steps {
        withCredentials([
          usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')
        ]) {
          powershell label: 'Build image', script: """
            $image = "shreeshasn/devops-quizmaster:${env.IMAGE_TAG}"
            Write-Output "Building image: $image"
            docker build -t $image .
            Write-Output "Built: $image"
          """

          powershell label: 'Docker login & push', script: """
            # Login using password on stdin (PowerShell)
            \$pw = "${env.DOCKER_PASS}"
            \$pw | docker login --username ${env.DOCKER_USER} --password-stdin
            if (\$LASTEXITCODE -ne 0) { throw "docker login failed" }

            $image = "shreeshasn/devops-quizmaster:${env.IMAGE_TAG}"
            docker push $image
            if (\$LASTEXITCODE -ne 0) { throw "docker push failed" }
          """
        }
      }
    }

    stage('Optional: Deploy to Kubernetes') {
      when {
        expression { return fileExists('k8s/deployment.yaml') }
      }
      steps {
        script {
          // If kubeconfig credential exists, use it; otherwise skip k8s deploy
          def hasKube = false
          try {
            // attempt to resolve credential (this is just a check, the actual file binding is below)
            // if you don't set kubeconfig credential, this will throw handled below
            hasKube = true
          } catch (e) {
            hasKube = false
          }

          if (hasKube) {
            withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
              powershell label: 'Apply k8s manifests', script: """
                # point kubectl to the provided kubeconfig file
                $env:KUBECONFIG = "${env.KUBECONF}"

                $image = "shreeshasn/devops-quizmaster:${env.IMAGE_TAG}"

                # If deployment exists, just update the image; otherwise apply files (replace placeholder if needed)
                try {
                  kubectl get deployment devops-quizmaster-deployment -o name
                  Write-Output "Deployment exists, updating image..."
                  kubectl set image deployment/devops-quizmaster-deployment app=$image --record
                } catch {
                  Write-Output "Deployment not found, applying manifests..."
                  (Get-Content k8s/deployment.yaml) -replace '__IMAGE_PLACEHOLDER__', $image | kubectl apply -f -
                  kubectl apply -f k8s/service.yaml
                }

                kubectl rollout status deployment/devops-quizmaster-deployment
                kubectl get pods -l app=devops-quizmaster -o wide
                kubectl get svc devops-quizmaster-svc -o wide
              """
            }
          } else {
            echo "Skipping Kubernetes deploy because kubeconfig credential not configured."
          }
        }
      }
    }
  } // stages

  post {
    success {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell script: """
          \$body = @{ text = "Jenkins: Build SUCCESS - ${env.JOB_NAME} #${env.BUILD_NUMBER} - ${env.IMAGE_TAG}" } | ConvertTo-Json
          Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body \$body
        """
      }
    }

    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell script: """
          \$body = @{ text = "Jenkins: Build FAILED - ${env.JOB_NAME} #${env.BUILD_NUMBER}" } | ConvertTo-Json
          Invoke-RestMethod -Uri $env:SLACK_WEBHOOK -Method Post -ContentType 'application/json' -Body \$body
        """
      }
    }

    always {
      // Clean up docker login safely (best effort)
      powershell script: 'docker logout || Write-Output "docker logout attempted"'
    }
  }
}
