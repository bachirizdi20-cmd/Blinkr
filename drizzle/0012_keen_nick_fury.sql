ALTER TABLE `media_statuses` DROP INDEX `media_statuses_user_media_idx`;--> statement-breakpoint
ALTER TABLE `reviews` DROP INDEX `reviews_user_media_idx`;--> statement-breakpoint
ALTER TABLE `media_statuses` ADD `mediaSource` varchar(32);--> statement-breakpoint
ALTER TABLE `reviews` ADD `mediaSource` varchar(32);--> statement-breakpoint
ALTER TABLE `media_statuses` ADD CONSTRAINT `media_statuses_user_media_idx` UNIQUE(`userId`,`mediaType`,`mediaId`,`mediaSource`);--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_media_idx` UNIQUE(`userId`,`mediaType`,`mediaId`,`mediaSource`);
