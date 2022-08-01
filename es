docker run \
  -d \
  --name elasticsearch \
  --network host \
  -e "discovery.type=single-node" \
  docker.elastic.co/elasticsearch/elasticsearch:7.9.2

docker run \
  -d \
  --name kibana \
  --network host \
  -e "ELASTICSEARCH_HOSTS=http://localhost:9200" \
  docker.elastic.co/kibana/kibana:7.9.2

docker run \
  -d \
  --name=heartbeat \
  --user=heartbeat \
  --network host \
  --volume="$(pwd)/heartbeat.docker.yml:/usr/share/heartbeat/heartbeat.yml:ro" \
  docker.elastic.co/beats/heartbeat:7.9.2


kubectl apply -f https://download.elastic.co/downloads/eck/1.2.1/all-in-one.yaml

cat <<EOF | kubectl apply -f -
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata:
  name: es
spec:
  version: 7.9.2
  http:
    tls:
      selfSignedCertificate:
        disabled: true
    service:
      spec:
        type: NodePort
        ports:
        - name: http
          port: 9200
          targetPort: 9200
          nodePort: 30200
  nodeSets:
  - name: node
    count: 1
    config:
      node.master: true
      node.data: true
      node.ingest: true
      node.store.allow_mmap: false
      xpack.security.authc:
        anonymous:
          username: anonymous
          roles: superuser
          authz_exception: false
    podTemplate:
      spec:
        volumes:
        - name: elasticsearch-data
          emptyDir: {}
        containers:
        - name: elasticsearch
          env:
          - name: ES_JAVA_OPTS
            value: -Xms4g -Xmx4g
          resources:
            requests:
              memory: 4Gi
            limits:
              memory: 8Gi
EOF

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v0.40.2/deploy/static/provider/baremetal/deploy.yaml

cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: es
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /\$2
spec:
  rules:
  - host: alice.io
    http:
      paths:
      - path: /elasticsearch(/|$)(.*)
        pathType: Exact
        backend:
          service:
            name: es-es-http
            port:
              number: 9200
EOF
