CREATE TABLE `invoke_info` (
  `id` int NOT NULL AUTO_INCREMENT,
  `systemId` varchar(4) DEFAULT '',
  `name` varchar(100) DEFAULT '',
  `descrption` varchar(200) DEFAULT '',
  `method` varchar(10) DEFAULT '',
  `url` varchar(200) DEFAULT '',
  `head` text,
  `body` text,
  `parseFun` longtext,
  `orginalResult` longtext,
  `next` varchar(200) DEFAULT '',
  `invokeType` varchar(10) DEFAULT '' COMMENT '1:接口调用配置,2:可调用接口',
  `groupName` varchar(50) DEFAULT '',
  `enableLog` varchar(2) DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=430 DEFAULT CHARSET=utf8mb3 ROW_FORMAT=COMPACT;
CREATE TABLE `invoke_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT '',
  `groupName` varchar(50) DEFAULT '',
  `key` varchar(100) DEFAULT '',
  `request` text,
  `response` text,
  `date` timestamp NULL DEFAULT NULL,
  `code` int DEFAULT NULL,
  `descrption` varchar(100) DEFAULT '',
  `url` varchar(200) DEFAULT '',
  `head` varchar(2000) DEFAULT '',
  `method` varchar(20) DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=89841 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;