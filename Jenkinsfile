pipeline {
  agent any

  environment {
    // Replace with your Docker Hub repo
    IMAGE_BASE = "shreeshasn/devops-quizmaster"
    // Force docker client to use TCP loopback (safe for local dev)
    DOCKER_HOST = "tcp://127.0.0.1:2375"
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
        script {
          if (isUnix()) {
            sh 'node -v || true; npm ci'
          } else {
            bat 'node -v || echo "node not found"'
            bat 'npm ci'
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
          def safeBranch = env.BRANCH_NAME.replaceAll('/', '-')
          env.IMAGE_TAG = "${IMAGE_BASE}:${safeBranch}-${sha}"

          if (isUnix()) {
            sh "docker build -t ${env.IMAGE_TAG} ."
          } else {
            // ensure DOCKER_HOST env var is used by the docker CLI on Windows
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
              // Use cmd to pipe password to docker login and push
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
          def msg = "✅ ${env.JOB_NAME} [${env.BRANCH_NAME}] build #${env.BUILD_NUMBER} succeeded — ${env.IMAGE_TAG}"
          if (isUnix()) {
            sh "curl -s -X POST -H 'Content-Type: application/json' --data '{\"text\":\"${msg.replaceAll('\"','\\\\\"')}\"}' ${SLACK_WEBHOOK} || true"
          } else {
            bat "powershell -NoProfile -Command \"Invoke-RestMethod -Uri '${SLACK_WEBHOOK}' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{text='${msg.replaceAll(\"'\",\"`'")} })\""
          }
        }
      }
    }
    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        script {
          def msg = "❌ ${env.JOB_NAME} [${env.BRANCH_NAME}] build #${env.BUILD_NUMBER} failed"
          if (isUnix()) {
            sh "curl -s -X POST -H 'Content-Type: application/json' --data '{\"text\":\"${msg.replaceAll('\"','\\\\\"')}\"}' ${SLACK_WEBHOOK} || true"
          } else {
            bat "powershell -NoProfile -Command \"Invoke-RestMethod -Uri '${SLACK_WEBHOOK}' -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{text='${msg.replaceAll(\"'\",\"`'")} })\""
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
        } catch (e) { echo "docker logout skipped: ${e}" }
      }
    }
  }
}
