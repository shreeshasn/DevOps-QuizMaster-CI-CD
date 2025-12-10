pipeline {
  agent { label 'windows' }
  options {
    timestamps()
    // no ansiColor because that caused issues in your Jenkins before
  }

  environment {
    // these will be populated during the run
    IMAGE_TAG = ''
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
          // get short commit sha (PowerShell invoked from Jenkins pipeline helper)
          def sha = powershell(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
          if (!sha) {
            // fallback
            sha = "${env.BUILD_ID}"
          }
          env.IMAGE_TAG = "shreeshasn/devops-quizmaster:main-${sha}"
          echo "IMAGE_TAG = ${env.IMAGE_TAG}"
        }
      }
    }

    stage('Set API key & Install') {
      steps {
        // QUIZ API key is stored in credential id 'quiz-api-key' as a secret text
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          // write .env.local used by the app (Vite expects VITE_ prefix)
          powershell """
            Set-Content -Path .env.local -Value \"VITE_API_KEY=$env:QUIZ_API_KEY\" -Force
            Write-Output 'Created .env.local'
          """
        }

        // npm install (Windows PowerShell)
        powershell 'node -v'
        powershell 'npm ci'
      }
    }

    stage('Build') {
      steps {
        powershell 'npm run build'
      }
    }

    stage('Docker Build') {
      steps {
        script {
          // ensure docker host if your environment needs it (optional)
          // Uncomment or set if Docker daemon is on tcp://127.0.0.1:2375
          // env.DOCKER_HOST = 'tcp://127.0.0.1:2375'

          powershell """
            Write-Output 'Building Docker image: ${env.IMAGE_TAG}'
            docker build -t ${env.IMAGE_TAG} .
          """
        }
      }
    }

    stage('Docker Push') {
      steps {
        // dockerhub-creds must be a username/password credential
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
          powershell """
            Write-Output 'Logging into Docker Hub'
            $env:DOCKERHUB_PASS | docker login -u $env:DOCKERHUB_USER --password-stdin
            Write-Output 'Pushing image ${env.IMAGE_TAG}'
            docker push ${env.IMAGE_TAG}
            Write-Output 'Docker push completed'
            docker logout
          """
        }
      }
    }

    stage('Deploy to Kubernetes') {
      when {
        anyOf {
          branch 'main'
          branch 'master'
        }
      }
      steps {
        // kubeconfig must be stored as Secret File with id 'kubeconfig'
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
          powershell """
            Write-Output 'Using kubeconfig file: $env:KUBECONF'
            $env:KUBECONFIG = \"$env:KUBECONF\"

            # if deployment exists, update image, else apply manifests (replace placeholder)
            if (kubectl get deployment devops-quizmaster-deployment -o name) {
              Write-Output 'Deployment exists — updating image'
              kubectl set image deployment/devops-quizmaster-deployment app=${env.IMAGE_TAG} --record
              kubectl rollout status deployment/devops-quizmaster-deployment
            } else {
              Write-Output 'Deployment not found — creating from k8s manifests'
              # replace placeholder __IMAGE_PLACEHOLDER__ in deployment.yaml with actual image tag, then apply
              (Get-Content k8s/deployment.yaml) -replace '__IMAGE_PLACEHOLDER__', '${env.IMAGE_TAG}' | kubectl apply -f -
              kubectl apply -f k8s/service.yaml
              kubectl rollout status deployment/devops-quizmaster-deployment
            }
          """
        }
      }
    }

    stage('Notify (Slack)') {
      steps {
        // slack-webhook stored as secret text; we'll call it in post as well but do an explicit notify here too
        withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
          powershell """
            $body = @{ text = \"Build succeeded: ${env.JOB_NAME} #${env.BUILD_NUMBER}\\nImage: ${env.IMAGE_TAG}\\nBranch: ${env.GIT_BRANCH ?: 'unknown'}\" }
            Invoke-RestMethod -Uri \"$env:SLACK_WEBHOOK\" -Method Post -ContentType 'application/json' -Body (ConvertTo-Json $body)
            Write-Output 'Slack notified (success)'
          """
        }
      }
    }
  } // stages

  post {
    success {
      echo 'Pipeline succeeded'
    }
    failure {
      // notify Slack on failure
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        powershell """
          $body = @{ text = \"Build FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}\\nBranch: ${env.GIT_BRANCH ?: 'unknown'}\\nImage (if produced): ${env.IMAGE_TAG}\" }
          Invoke-RestMethod -Uri \"$env:SLACK_WEBHOOK\" -Method Post -ContentType 'application/json' -Body (ConvertTo-Json $body)
          Write-Output 'Slack notified (failure)'
        """
      }
    }
    always {
      // cleanup any local docker login credentials (best-effort)
      powershell 'docker logout || Write-Output \"docker logout failed or not logged in\"'
      echo "Finished: ${currentBuild.currentResult}"
    }
  }
}
