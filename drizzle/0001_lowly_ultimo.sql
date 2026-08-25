CREATE TABLE `user_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(64) NOT NULL DEFAULT 'cinephile',
	`bio` varchar(160) NOT NULL DEFAULT '',
	`avatarUrl` text,
	`isPrivate` boolean NOT NULL DEFAULT false,
	`libraryJson` longtext NOT NULL DEFAULT '{}',
	`socialJson` longtext NOT NULL DEFAULT '{}',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_data_user_id_idx` UNIQUE(`userId`)
);
