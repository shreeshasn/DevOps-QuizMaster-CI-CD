pipeline {
  agent any

  environment {
    IMAGE_BASE = "shreeshasn/devops-quizmaster"    // change if needed
    DOCKER_HOST = "tcp://127.0.0.1:2375"           // for Windows docker CLI connectivity
    // deploy only from main
    KUBE_DEPLOY = "${env.BRANCH_NAME == 'main' ? 'true' : 'false'}"
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          if (isUnix()) {
            sh 'git rev-parse --short HEAD > .gitsha'
          } else {
            bat 'git rev-parse --short HEAD > .gitsha'
          }
        }
      }
    }

    stage('Install') {
      steps {
        // create .env.local from Jenkins secret before building
        withCredentials([string(credentialsId: 'QUIZ_API_KEY', variable: 'QUIZ_API_KEY')]) {
          script {
            if (isUnix()) {
              // write .env.local
              sh '''
                cat > .env.local <<'EOF'
                VITE_API_KEY=${QUIZ_API_KEY}
                EOF
              '''
              sh 'node -v || true'
              sh 'npm ci'
            } else {
              // Windows: create .env.local using PowerShell, then install
              bat """
                powershell -NoProfile -Command ^
                  \$key = [System.Environment]::GetEnvironmentVariable('QUIZ_API_KEY'); ^
                  Set-Content -Path .env.local -Value \"VITE_API_KEY=\$key\" -Force
              """
              bat 'node -v || echo "node not found"'
              bat 'npm ci'
            }
          }
        }
      }
    }

    stage('Build') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm run build'
          } else {
            bat 'npm run build'
          }
        }
      }
    }

    stage('Build Docker Image') {
      steps {
        script {
          def sha = readFile('.gitsha').trim()
          def safeBranch = env.BRANCH_NAME ? env.BRANCH_NAME.replaceAll('/', '-') : 'local'
          env.IMAGE_TAG = "${IMAGE_BASE}:${safeBranch}-${sha}"

          if (isUnix()) {
            sh "docker build -t ${env.IMAGE_TAG} ."
          } else {
            bat "set DOCKER_HOST=${DOCKER_HOST} && docker build -t ${env.IMAGE_TAG} ."
          }
        }
      }
    }

    stage('Push Image') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
          script {
            if (isUnix()) {
              sh 'echo "$DOCKERHUB_PASS" | docker login -u "$DOCKERHUB_USER" --password-stdin'
              sh "docker push ${env.IMAGE_TAG}"
            } else {
              bat "set DOCKER_HOST=${DOCKER_HOST} && echo %DOCKERHUB_PASS% | docker login -u %DOCKERHUB_USER% --password-stdin"
              bat "set DOCKER_HOST=${DOCKER_HOST} && docker push ${env.IMAGE_TAG}"
            }
          }
        }
      }
    }

    stage('Optional: Deploy to K8s') {
      when {
        expression { return fileExists('k8s/deployment.yaml') && env.KUBE_DEPLOY == 'true' }
      }
      steps {
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
          script {
            if (isUnix()) {
              sh '''
                export KUBECONFIG="$KUBECONF"
                if kubectl get deployment devops-quizmaster-deployment >/dev/null 2>&1; then
                  kubectl set image deployment/devops-quizmaster-deployment app=${IMAGE_TAG} --record
                else
                  sed "s|__IMAGE_PLACEHOLDER__|${IMAGE_TAG}|g" k8s/deployment.yaml | kubectl apply -f -
                fi
              '''
            } else {
              bat '''
                powershell -NoProfile -Command ^
                  $env:KUBECONFIG="$env:KUBECONF"; ^
                  if (kubectl get deployment devops-quizmaster-deployment -o name) { ^
                    kubectl set image deployment/devops-quizmaster-deployment app=%IMAGE_TAG% --record ^
                  } else { ^
                    (Get-Content k8s/deployment.yaml) -replace "__IMAGE_PLACEHOLDER__", "%IMAGE_TAG%" | kubectl apply -f - ^
                  }
              '''
            }
          }
        }
      }
    }
  } // stages

  post {
    success {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        script {
          def msg = "✅ ${env.JOB_NAME} [${env.BRANCH_NAME ?: 'local'}] build #${env.BUILD_NUMBER} succeeded — ${env.IMAGE_TAG}"
          env.NOTIFY_MSG = msg
          if (isUnix()) {
            sh "curl -s -X POST -H 'Content-Type: application/json' --data '{\"text\":\"${msg.replaceAll('\"','\\\\\"')}\"}' ${env.SLACK_WEBHOOK} || true"
          } else {
            bat """
              powershell -NoProfile -Command ^
                \$body = @{ text = [System.Environment]::GetEnvironmentVariable('NOTIFY_MSG') }; ^
                Invoke-RestMethod -Uri '${env.SLACK_WEBHOOK}' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json \$body)
            """
          }
        }
      }
    }

    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        script {
          def msg = "❌ ${env.JOB_NAME} [${env.BRANCH_NAME ?: 'local'}] build #${env.BUILD_NUMBER} failed"
          env.NOTIFY_MSG = msg
          if (isUnix()) {
            sh "curl -s -X POST -H 'Content-Type: application/json' --data '{\"text\":\"${msg.replaceAll('\"','\\\\\"')}\"}' ${env.SLACK_WEBHOOK} || true"
          } else {
            bat """
              powershell -NoProfile -Command ^
                \$body = @{ text = [System.Environment]::GetEnvironmentVariable('NOTIFY_MSG') }; ^
                Invoke-RestMethod -Uri '${env.SLACK_WEBHOOK}' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json \$body)
            """
          }
        }
      }
    }

    cleanup {
      script {
        try {
          if (isUnix()) {
            sh 'docker logout || true'
          } else {
            bat 'cmd /c "set DOCKER_HOST=%DOCKER_HOST% && docker logout || echo logout-failed"'
          }
        } catch (e) {
          echo "docker logout skipped: ${e}"
        }
      }
    }
  }
}
