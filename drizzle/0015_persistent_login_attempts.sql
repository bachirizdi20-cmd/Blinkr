CREATE TABLE `login_attempts` (
  `emailHash` varchar(64) NOT NULL,
  `attemptCount` int NOT NULL DEFAULT 0,
  `windowStartedAt` timestamp NOT NULL,
  CONSTRAINT `login_attempts_emailHash_pk` PRIMARY KEY (`emailHash`)
);
--> statement-breakpoint
CREATE INDEX `login_attempts_window_idx` ON `login_attempts` (`windowStartedAt`);
