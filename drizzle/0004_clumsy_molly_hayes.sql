CREATE TABLE `media_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mediaType` varchar(8) NOT NULL,
	`mediaId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`posterPath` varchar(255),
	`status` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `media_statuses_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_statuses_user_media_idx` UNIQUE(`userId`,`mediaType`,`mediaId`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mediaType` varchar(8) NOT NULL,
	`mediaId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`posterPath` varchar(255),
	`rating` int NOT NULL,
	`review` longtext NOT NULL,
	`spoiler` boolean NOT NULL DEFAULT false,
	`watchedDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_user_media_idx` UNIQUE(`userId`,`mediaType`,`mediaId`)
);
