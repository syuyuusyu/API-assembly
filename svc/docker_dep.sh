v="1.0"
ip="swr.cn-north-1.myhuaweicloud.com"
name="api_assembly"
docker buildx build --platform linux/amd64 --load -t $ip/$name:$v . &&
docker push $name:$v &&
echo $ip/$name:$v