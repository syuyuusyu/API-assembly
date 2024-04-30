# This project is used to configure and forward third-party interfaces. [中文](README_C.md)

This project primarily serves the purpose of providing a runtime environment for executing JavaScript code using configurations. Users can write JavaScript code to fulfill their data transformation needs, such as changing the data format or renaming certain fields. The configured content can then be published as a new interface. This allows for the transformation of data from different third-party interfaces into a unified format with consistent field names, facilitating the invocation of specific business logic code.

# useage

The code requires a Node.js, MySQL, and Redis environment and is only suitable for JSON-format interfaces. 

1. First, configure the MySQL and Redis connection information in `/svc/config/config.default.js`.
2. Execute the table creation statements in `/svc/initial.sql`.
3. In the `/svc` directory, run `npm i` to install the required dependencies.
4. Then, in the same directory, run `npm start` to start the program.
5. Access the program configuration page via http://127.0.0.1:7001/index.html.

Under the `/ui` directory, you'll find the frontend page code. Copy the files from `/ui/build/` to `/svc/app/public/`, and then you can access it via `http://127.0.0.1:7001/index.html`.

# example

Below, I'll introduce the specific usage through three typical scenarios. First, import the example configurations from /svc/example.sql into the database.

## Scenario 1: Configuring and Forwarding Third-Party Interfaces

The system has two different concepts of configuration: "API Configuration" and "Callable API."

- **API Configuration**: This configures the invocation information for third-party interfaces but does not itself serve as a new interface for publication.
  
- **Callable API**: This publishes a new interface that can be called externally and requires association with an "API Configuration" for use.


There are two third-party interfaces available (normally, these interfaces would come from other systems, but here, for demonstration purposes, they are self-configured).
```
http://127.0.0.1:7001/invoke/mock_city
 {
    "provinceId":"xxxx"
 }
```

```
http://127.0.0.1:7001/invoke/mock_district
 {
    "cityId":"xxxx"
 }
```
The two interfaces respectively query the list of cities through `provinceId` and the list of areas through `cityId`.

To create a new configuration, click on "New API Configuration" on the page to open an interface configuration page. Here, simply click on the edit icon button for the "transform_city" record.
Below is an example illustrating the specific configuration of the `mock_city` interface. ![mock_city](./readmePic/transform_city.png)  


### system
Associated with the `config.systemInfo` configuration in the `svc/config/config.default.js` file, users need to modify this configuration according to their actual needs.

### name
The name of the call must be globally unique.

### group name
It's used for querying purposes, and typically groups several related business logic interfaces together.

### save log
If configured as YES, invoking this interface will record the call information in the "invoke_log" table. You can view the records in the LOG tab on the page. Additionally, there's an optional configuration in the request header called "logKey": "@requestField". When configured, the logs will be recorded with the value of @requestField as the keyword, making it easier to query.

### URL
The address of the third-party interface. "@baseUrl" is a reserved keyword in the program and will be replaced with the corresponding URL content in `config.systemInfo` when invoked. Alternatively, you can choose not to use "@baseUrl" and directly use the original address of the interface.

### relevant request
Will be introduced in the next use case.

### request body
The request parameters use @xxx as placeholders. When calling the interface, the specific values passed in will replace the values of @xxx in the URL, headers, and body. The specific calling method will be introduced later.

### paraphrase function

A valid JavaScript code snippet, used to parse the data returned by the interface into the format desired by the user, with the method callback parameters `resObj`, `resHead`, `resStatus`, `reqHead`, `reqBody`, and `url` respectively corresponding to `responseBody`, `responseHead`, `httpCode`, `requestHead`, `requestBody`, and `url`. In the example, the structure and field names of the data are modified, and the field `requestField` in the `requestBody` is added to the result.

After configuration is completed, you can click the TEST button to open the test page and confirm if the configuration is correct. ![test](./readmePic/test.png)  

Fields marked with @xxx in the previous page will be required as parameters for the caller to provide. The content in the two windows above and below the parsing function corresponds to the data returned by the original interface and the data processed by the parsing function, respectively. If there is an error in the parsing function itself, the window below may not display properly. You can modify and debug the parsing function in this window. (<span style="color: red;">After debugging, please copy the content of the parsing function to the previous window for saving. The content modified in the current window will not be saved.</span>)

### Publish the above configuration as a new interface.

If you need to create a new interface, click on the "new Callable API" page, and open an interface configuration page. Here, you can directly click on the edit icon button for the "transform_data" record.![callable](./readmePic/callable.png)

The name here will be used as the new interface name, and the program will publish a POST interface with the URL `http://127.0.0.1:7001/invoke/transform_data`. The configuration of relevant requests indicates that the `transform_city` and `transform_district` interfaces can be called through this interface.

In the parsing function, use a built-in function `this.defaultValue(obj)` to retrieve the value returned by the third-party interface. Here, the content in `obj` has an extra layer wrapped around it, similar to this:
```
{
    transform_city:{
        ....
    }
}
``` 
Using this format because in other use cases, the `obj` object can be quite complex, but here, only `this.defaultValue(obj)` is needed to obtain the desired result.

Clicking the TEST button opens a testing page for calling the interface  ![calltest](./readmePic/calltest.png)
 Since http://127.0.0.1:7001/invoke/transform_data is already an externally callable interface, other interface tools such as curl or postman can also be used to call it.

Here's some additional information about the usage of the @xxx placeholders for input parameters:

In the input JSON:
```json
{
  "activeMethod":"transform_city",
  "provinceId":"500000",
  "requestField":"some value"
}
```
The fields after @xxx are determined based on the configuration of `transform_city`:
```json
{
  "provinceId":"@provinceId",
  "requestField":"@requestField"
}
```
So, the xxx after @xxx represents the fields used as input parameters during the call. For example, if the configuration of `transform_city` is modified as follows:
```json
{
  "provinceId":"@id",
  "requestField":"@field"
}
```
Then the corresponding input parameters during the call should also be modified accordingly:
```json
{
  "activeMethod":"transform_city",
  "id":"500000",
  "field":"some value"
}
```

Since `transform_data` is associated with two configurations, `transform_city` and `transform_district`, the parameter `"activeMethod":"transform_city"` is used to specify which configuration to call. Alternatively, you can use `"activeMethod":["transform_city","transform_district"]` to call both configurations simultaneously. In this case, the input parameters should include the parameters required for `transform_district`, and the outer parsing function should also be modified accordingly, like this:
```json
{
  "activeMethod":["transform_city","transform_district"],
  "provinceId":"500000",
  "requestField":"some value",
  "cityId":"xxxx" //parameter for transform_district
}
```
If the activeMethod parameter is not passed, all associated configurations will be called simultaneously. If parameters for a certain configuration are not correctly passed, it may lead to abnormal results.

It's common to associate multiple `API Configuration` with a single `Callable API` and use `"activeMethod":"xxx"` during the call to specify which configuration to use.


## Scene 2: Assembling Multiple Interfaces

Assuming there are now three third-party interfaces.
```
http://127.0.0.1:7001/invoke/mock_province
 {}
```

```
http://127.0.0.1:7001/invoke/mock_city
 {
    "provinceId":"xxxx"
 }
```

```
http://127.0.0.1:7001/invoke/mock_district
 {
    "cityId":"xxxx"
 }
```
The parameter of the interface `mock_district` needs to be queried through the interface `mock_city`, and the parameters of the interface `mock_city` need to be queried through the interface `mock_province`. In this case, you can combine the three interfaces by first calling `mock_province`, then associating with `mock_city`, and then associating with `mock_district`, thus obtaining all information under the three interfaces in one go. This combination is commonly used in scenarios where a third-party business system provides two interfaces: one for fetching a list of resources, and another for fetching details of resources based on parameters in the list. Combining these two interfaces allows you to fetch both the list and details in one go.

Open the configuration page of `assemble_province`.![assemble_province](./readmePic/assemble_province.png)

Open the configuration page of `assemble_province`. It is associated with `assemble_city`. Since the parameters of `assemble_city` are as follows:
```
{
  "provinceId":"@provinceId"
}
```
a new field has been added to the parsing function here:
```
{
    provinceId:o.id,
    ...o
}
```
This way, the result of `assemble_province` can be used as the input parameter for `assemble_city`. The program will call the subordinate associated interface after the previous interface returns. (Here, calling the subordinate associated interface also has a condition: the return value of the current interface must be an array, and the subordinate interface will be called concurrently for each item in the array.) Thanks to the concurrent mechanism of Node.js, I personally haven't encountered any performance issues using this type of calling in a production environment.

The configuration of `assemble_city` is similar to that of `assemble_province`.

Now, let's go back to the configuration of the callable interface `assemble_all`, which is associated with `assemble_province`. After multiple layers of association, all the data can be retrieved. The retrieved data looks something like this:
```json
{
  "assemble_province-1": [
    {"provinceId": "110000", "id": "110000", "parentId": "0", "name": "北京市", "type": "province"},
    {"provinceId": "120000", "id": "120000", "parentId": "0", "name": "天津市", "type": "province"},
    {"provinceId": "500000", "id": "500000", "parentId": "0", "name": "重庆市", "type": "province"}
  ],
  "assemble_city-1-2": [
    {"cityId": "110100", "id": "110100", "parentId": "110000", "name": "北京城区", "type": "city"}
  ],
  "assemble_city-1-3": [
    {"cityId": "120100", "id": "120100", "parentId": "120000", "name": "天津城区", "type": "city"}
  ],
  "assemble_city-1-4": [
    {"cityId": "500100", "id": "500100", "parentId": "500000", "name": "重庆城区", "type": "city"},
    {"cityId": "500200", "id": "500200", "parentId": "500000", "name": "重庆郊县", "type": "city"}
  ],
  "assemble_district-1-2-3": [
    {"id": "110101", "parentId": "110100", "name": "东城区", "type": "district"},
    {"id": "110102", "parentId": "110100", "name": "西城区", "type": "district"}
  ],
  "assemble_district-1-3-4": [
    {"id": "120101", "parentId": "120100", "name": "和平区", "type": "district"},
    {"id": "120102", "parentId": "120100", "name": "河东区", "type": "district"}
    {"id": "120119", "parentId": "120100", "name": "蓟州区", "type": "district"}
  ],
  "assemble_district-1-4-5": [
    {"id": "500101", "parentId": "500100", "name": "万州区", "type": "district"},
    {"id": "500156", "parentId": "500100", "name": "武隆区", "type": "district"}
  ],
  "assemble_district-1-4-6": [
    {"id": "500229", "parentId": "500200", "name": "城口县", "type": "district"},
    {"id": "500230", "parentId": "500200", "name": "丰都县", "type": "district"}
  ]
}
```
All the data is tiled in an object in the form of `name-number`. Here, the number ensures that all the keys are unique; the number itself does not have any logical significance. Users need to concatenate the data according to their needs. In the parsing function, `const districtList = this.keyList(obj,'assemble_district')`. `this.keyLists` is a built-in function that concatenates all data starting with the same name into an array. There are two built-in functions in the parsing function of the callable interface. The other one is the previously mentioned `this.defaultValue`.

With the parsing function in the example, the data is parsed into the final form. Readers can call the interface themselves to view the final result.


## Scenario 3: Generating Mock Data

The above introduction is based on configuring mock data interfaces. You can query the corresponding mock configurations for specific details. The program itself has an interface at `http://127.0.0.1:7001/doNothing`, which returns an empty object. You can use the parsing function of this interface to return mock data, or you can save some JSON-formatted configuration data that other programs need here. This way, other programs can call the interface to obtain these configurations without having to create tables specifically to handle certain configuration information, and modifications are also very convenient.








