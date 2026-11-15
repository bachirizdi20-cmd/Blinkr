ALTER TABLE `review_comments`
  ADD COLUMN `parentCommentId` INT NULL AFTER `userId`;

CREATE INDEX `review_comments_review_id_idx` ON `review_comments` (`reviewId`);
CREATE INDEX `review_comments_parent_id_idx` ON `review_comments` (`parentCommentId`);
