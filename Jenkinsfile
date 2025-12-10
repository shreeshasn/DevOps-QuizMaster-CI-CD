pipeline {
  agent any

  environment {
    IMAGE_BASE = "shreesha/devops-quizmaster" // <-- set this
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
          // write short sha to file in a cross-platform way
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
            sh 'node -v || true'
            sh 'npm ci'
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
            bat "docker build -t ${env.IMAGE_TAG} ."
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
              // Windows CMD: pipe password into docker login
              bat "cmd /c \"echo %DOCKERHUB_PASS% | docker login -u %DOCKERHUB_USER% --password-stdin\""
              bat "docker push ${env.IMAGE_TAG}"
            }
          }
        }
      }
    }

    stage('Deploy to K8s (optional)') {
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
              // Use PowerShell style on Windows
              bat '''
                powershell -Command ^
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
          // Use Groovy HTTP to post to Slack (avoids shell)
          def text = "✅ ${env.JOB_NAME} [${env.BRANCH_NAME}] build #${env.BUILD_NUMBER} succeeded — ${env.IMAGE_TAG}"
          sendSlack(env.SLACK_WEBHOOK, text)
        }
      }
    }
    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        script {
          def text = "❌ ${env.JOB_NAME} [${env.BRANCH_NAME}] build #${env.BUILD_NUMBER} failed"
          sendSlack(env.SLACK_WEBHOOK, text)
        }
      }
    }
    cleanup {
      script {
        try {
          if (isUnix()) {
            sh 'docker logout || true'
          } else {
            bat 'cmd /c "docker logout || echo logout-failed"'
          }
        } catch (e) { echo "docker logout skipped: ${e}" }
      }
    }
  } // post

} // pipeline

// helper function to post to slack using pure JVM (no external curl)
def sendSlack(String webhookUrl, String message) {
  try {
    def payload = "{\"text\":\"${message.replaceAll('"','\\\"')}\"}"
    def url = new URL(webhookUrl)
    def conn = url.openConnection()
    conn.setRequestMethod("POST")
    conn.setDoOutput(true)
    conn.setRequestProperty("Content-Type", "application/json")
    def os = conn.getOutputStream()
    os.write(payload.getBytes("UTF-8"))
    os.flush()
    os.close()
    def respCode = conn.getResponseCode()
    echo "Slack post response code: ${respCode}"
  } catch (err) {
    echo "Failed to send slack message: ${err}"
  }
}
