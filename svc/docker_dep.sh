v="arm"
# ip="swr.cn-north-1.myhuaweicloud.com"
# name="bqm/api_assembly"
ip="docker.io"
name="syuyuusyu/api_assembly"
docker build -t $ip/$name:$v . &&
#docker build --platform linux/amd64 -t $ip/$name:$v . &&
docker push $ip/$name:$v &&
echo $ip/$name:$v