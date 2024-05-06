v="1.1"
ip="swr.cn-north-1.myhuaweicloud.com"
name="bqm/api_assembly"
# ip="syuyuusyu"
# name="api_assembly"
#docker buildx build --platform linux/amd64 --load -t $ip/$name:$v . &&
#docker build -t $ip/$name:$v . &&
docker build --platform linux/amd64 -t $ip/$name:$v . &&
docker push $ip/$name:$v &&
echo $ip/$name:$v