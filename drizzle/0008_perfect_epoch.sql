ALTER TABLE `chat_messages` ADD `sharedMediaType` varchar(8);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `sharedMediaId` int;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `sharedTitle` varchar(255);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `sharedPosterPath` varchar(255);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `sharedRating` int;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `sharedOverview` text;