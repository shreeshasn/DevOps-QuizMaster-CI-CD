pipeline {
  agent any
  environment {
    IMAGE_BASE = "shreeshasn/devops-quizmaster" // replace this
  }
  options { timeout(time:30, unit:'MINUTES') }
  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'git rev-parse --short HEAD > .gitsha'
      }
    }
    stage('Install') {
      steps { sh 'node -v || true; npm ci' }
    }
    stage('Build') {
      steps { sh 'npm run build' }
    }
    stage('Docker Build') {
      steps {
        script {
          def sha = readFile('.gitsha').trim()
          def safeBranch = env.BRANCH_NAME.replaceAll("/", "-")
          env.IMAGE_TAG = "${IMAGE_BASE}:${safeBranch}-${sha}"
          sh "docker build -t ${env.IMAGE_TAG} ."
        }
      }
    }
    stage('Push Image') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
          sh 'echo "$DOCKERHUB_PASS" | docker login -u "$DOCKERHUB_USER" --password-stdin'
          sh "docker push ${env.IMAGE_TAG}"
        }
      }
    }
    stage('Optional: Deploy to k8s') {
      when { expression { return fileExists('k8s/deployment.yaml') && env.KUBE_DEPLOY == 'true' } }
      steps {
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONF')]) {
          sh '''
            export KUBECONFIG="$KUBECONF"
            if kubectl get deployment devops-quizmaster-deployment >/dev/null 2>&1; then
              kubectl set image deployment/devops-quizmaster-deployment app=${IMAGE_TAG} --record
            else
              sed "s|__IMAGE_PLACEHOLDER__|${IMAGE_TAG}|g" k8s/deployment.yaml | kubectl apply -f -
            fi
          '''
        }
      }
    }
  }
  post {
    success {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        script {
          def text = "✅ ${env.JOB_NAME} [${env.BRANCH_NAME}] #${env.BUILD_NUMBER} succeeded — ${env.IMAGE_TAG}"
          sh "curl -s -X POST -H 'Content-type: application/json' --data '{\"text\":\"${text}\"}' ${SLACK_WEBHOOK} || true"
        }
      }
    }
    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        script {
          def text = "❌ ${env.JOB_NAME} [${env.BRANCH_NAME}] #${env.BUILD_NUMBER} failed"
          sh "curl -s -X POST -H 'Content-type: application/json' --data '{\"text\":\"${text}\"}' ${SLACK_WEBHOOK} || true"
        }
      }
    }
  }
}
