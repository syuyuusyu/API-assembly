DROP TABLE IF EXISTS `invoke_info`;
CREATE TABLE `invoke_info` (
  `id` int(4) NOT NULL AUTO_INCREMENT,
  systemId varchar(20) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `descrption` varchar(200) DEFAULT NULL,
  `method` varchar(10) DEFAULT NULL,
  `url` varchar(200) DEFAULT NULL,
  `head` text DEFAULT NULL,
  `body` text DEFAULT NULL,
  `parseFun` text DEFAULT NULL,
  `orginalResult` longtext DEFAULT NULL,
  `next` varchar(50) DEFAULT NULL,
  `invokeType` char(1) DEFAULT NULL COMMENT '1:接口调用配置,2:可调用接口',
  `groupName` varchar(50) DEFAULT NULL,
  enableLog varchar(2)  DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 ROW_FORMAT=COMPACT;

DROP TABLE IF EXISTS `invoke_log`;
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
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 ROW_FORMAT=COMPACT;
CREATE INDEX invoke_log_date_index ON invoke_log (`date`);
CREATE INDEX invoke_log_key_index ON invoke_log (`key`);
CREATE INDEX invoke_log_name_index ON invoke_log (`name`);