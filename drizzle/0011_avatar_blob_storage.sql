CREATE TABLE `avatar_blobs` (
	`key` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`contentType` varchar(64) NOT NULL DEFAULT 'image/jpeg',
	`data` mediumblob NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `avatar_blobs_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE INDEX `avatar_blobs_user_id_idx` ON `avatar_blobs` (`userId`);