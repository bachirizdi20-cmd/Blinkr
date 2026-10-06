ALTER TABLE `notifications` MODIFY COLUMN `kind` enum('follow','like','comment','message') NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `conversationId` int;