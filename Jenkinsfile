pipeline {
  agent any

  environment {
    // change this to your dockerhub user/repo (no tag)
    IMAGE_BASE = "your-dockerhub-username/devops-quizmaster"
  }

  options {
    skipDefaultCheckout(false)
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  stages {
    stage('Checkout') {
      steps {
        // Multibranch Pipeline provides BRANCH_NAME automatically
        checkout scm
        sh 'git rev-parse --short HEAD > .gitsha'
      }
    }

    stage('Install') {
      steps {
        sh 'node -v || true'
        sh 'npm ci'
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }

    stage('Build Docker Image') {
      steps {
        script {
          // tag: branch-<short-sha>
          def sha = readFile('.gitsha').trim()
          def safeBranch = env.BRANCH_NAME.replaceAll('/', '-')
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

    stage('Deploy to Kubernetes (optional)') {
      when {
        expression { return fileExists('k8s/deployment.yaml') && env.KUBE_DEPLOY == 'true' }
      }
      steps {
        // This requires a Jenkins credential of kind "Secret file" with your kubeconfig
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG_FILE')]) {
          sh '''
            export KUBECONFIG="$KUBECONFIG_FILE"
            # update image in deployment if exists, else apply the manifest
            if kubectl get deployment devops-quizmaster-deployment >/dev/null 2>&1; then
              kubectl set image deployment/devops-quizmaster-deployment app=${IMAGE_TAG} --record
            else
              # substitute IMAGE placeholder inside the manifest and apply
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
          def text = "✅ ${env.JOB_NAME} [${env.BRANCH_NAME}] build #${env.BUILD_NUMBER} succeeded\nImage: ${env.IMAGE_TAG}"
          sh "curl -s -X POST -H 'Content-type: application/json' --data '{\"text\": \"${text}\"}' ${SLACK_WEBHOOK} || true"
        }
      }
    }
    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK')]) {
        script {
          def text = "❌ ${env.JOB_NAME} [${env.BRANCH_NAME}] build #${env.BUILD_NUMBER} failed"
          sh "curl -s -X POST -H 'Content-type: application/json' --data '{\"text\": \"${text}\"}' ${SLACK_WEBHOOK} || true"
        }
      }
    }
    cleanup {
      // optional cleanup if needed
      sh 'docker logout || true'
    }
  }
}
