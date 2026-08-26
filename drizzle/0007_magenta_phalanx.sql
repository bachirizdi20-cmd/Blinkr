CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`senderId` int NOT NULL,
	`text` text,
	`mediaType` varchar(16),
	`mediaUrl` text,
	`mediaKey` text,
	`mediaMimeType` varchar(96),
	`mediaSize` int,
	`replyToId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	`deletedAt` timestamp,
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`participantAId` int NOT NULL,
	`participantBId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `conversations_pair_idx` UNIQUE(`participantAId`,`participantBId`)
);
