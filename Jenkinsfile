// Jenkinsfile - Multibranch friendly, Windows + Unix compatible
pipeline {
  agent { label 'master' } // or leave default node if you want
  environment {
    // set defaults; IMAGE_TAG will be computed at runtime
    DOCKER_REPO = "shreeshasn/devops-quizmaster"
    KUBE_DEPLOY = "true"           // set to "false" if you don't want automatic k8s deploy
    NOTIFY_MSG = "CI: build finished for ${env.BRANCH_NAME}"
  }
  options {
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
    ansiColor('xterm')
  }

  stages {
    stage('Declarative: Checkout SCM') {
      steps {
        checkout scm
      }
    }

    stage('Prepare') {
      steps {
        script {
          // record short git sha to .gitsha (works on Windows & Unix)
          if (isUnix()) {
            sh "git rev-parse --short HEAD > .gitsha"
          } else {
            bat 'git rev-parse --short HEAD 1>.gitsha'
          }
          // load it to a variable
          env.GIT_SHORT = readFile('.gitsha').trim()
          env.IMAGE_TAG = "${DOCKER_REPO}: ${env.GIT_SHORT}".replaceAll('\\s','') // ensure no spaces
          // better IMAGE_TAG: shreeshasn/devops-quizmaster:main-<sha>
          env.IMAGE_TAG = "${DOCKER_REPO}:${env.BRANCH_NAME}-${env.GIT_SHORT}"
        }
      }
    }

    stage('Install') {
      steps {
        // if you keep API keys in Jenkins credentials, inject here
        withCredentials([string(credentialsId: 'quiz-api-key', variable: 'QUIZ_API_KEY')]) {
          script {
            if (isUnix()) {
              sh '''
                echo "VITE_API_KEY=${QUIZ_API_KEY}" > .env.local
                node -v || echo "node not found"
                npm ci
              '''
            } else {
              // Windows agent
              bat """
powershell -NoProfile -Command ^
  Set-Content -Path .env.local -Value "VITE_API_KEY=${env.QUIZ_API_KEY}" -Force; ^
  node -v || Write-Host "node not found"
"""
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
          if (isUnix()) {
            sh "docker build -t ${env.IMAGE_TAG} ."
          } else {
            // For Windows local Docker Desktop; allow switching DOCKER_HOST if needed
            bat """
set DOCKER_HOST=tcp://127.0.0.1:2375
docker build -t ${env.IMAGE_TAG} .
"""
          }
        }
      }
    }

    stage('Push Image') {
      steps {
        withCredentials([
          string(credentialsId: 'dockerhub-username', variable: 'DOCKER_USER'),
          string(credentialsId: 'dockerhub-password', variable: 'DOCKER_PASS')
        ]) {
          script {
            if (isUnix()) {
              sh """
                echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin
                docker push ${env.IMAGE_TAG}
                docker logout || true
              """
            } else {
              bat """
set DOCKER_HOST=tcp://127.0.0.1:2375
echo ${DOCKER_PASS} | docker login -u ${DOCKER_USER} --password-stdin
docker push ${env.IMAGE_TAG}
docker logout || echo logout-failed
"""
            }
          }
        }
      }
    }

    stage('Optional: Deploy to K8s') {
      when {
        allOf {
          expression { return fileExists('k8s/deployment.yaml') }
          expression { return env.KUBE_DEPLOY == 'true' }
        }
      }
      steps {
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
          script {
            if (isUnix()) {
              // Unix-friendly (bash/sh)
              sh """
export KUBECONFIG="$KUBECONF"
if kubectl get deployment devops-quizmaster-deployment >/dev/null 2>&1; then
  kubectl set image deployment/devops-quizmaster-deployment app=${env.IMAGE_TAG} --record
  kubectl rollout status deployment/devops-quizmaster-deployment --timeout=120s || true
else
  sed "s|__IMAGE_PLACEHOLDER__|${env.IMAGE_TAG}|g" k8s/deployment.yaml | kubectl apply -f -
  kubectl rollout status deployment/devops-quizmaster-deployment --timeout=120s || true
fi
"""
            } else {
              // Windows PowerShell safe version
              bat """
powershell -NoProfile -Command ^
  \$Env:KUBECONFIG = "${env.KUBECONF}"; ^
  \$img = "${env.IMAGE_TAG}"; ^
  if (kubectl get deployment devops-quizmaster-deployment -o name 2>$null) { ^
    kubectl set image deployment/devops-quizmaster-deployment app=\$img --record; ^
    kubectl rollout status deployment/devops-quizmaster-deployment --timeout=120s; ^
  } else { ^
    (Get-Content 'k8s/deployment.yaml') -replace '__IMAGE_PLACEHOLDER__', \$img | kubectl apply -f -; ^
    kubectl rollout status deployment/devops-quizmaster-deployment --timeout=120s; ^
  }
"""
            }
          } // script
        } // withCredentials
      } // steps
    } // stage

  } // stages

  post {
    always {
      // Slack + cleanup actions
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        script {
          def msg = "${currentBuild.currentResult}: ${env.JOB_NAME} [${env.BRANCH_NAME}] #${env.BUILD_NUMBER} - ${env.IMAGE_TAG}"
          if (isUnix()) {
            sh """
PAYLOAD='{"text":"${msg}"}'
curl -s -X POST -H 'Content-type: application/json' --data "\$PAYLOAD" ${SLACK_WEBHOOK} || echo "slack-failed"
"""
          } else {
            bat """
powershell -NoProfile -Command ^
  \$body = @{ text = "${msg}" }; ^
  Invoke-RestMethod -Uri ${SLACK_WEBHOOK} -Method Post -ContentType 'application/json' -Body (ConvertTo-Json \$body) -ErrorAction SilentlyContinue; ^
  if (\$?) { Write-Host "slack ok" } else { Write-Host "slack failed" }
"""
          }
        }
      }
    }

    success {
      echo "Build succeeded: ${env.IMAGE_TAG}"
    }

    failure {
      echo "Build failed"
    }
  } // post
}
