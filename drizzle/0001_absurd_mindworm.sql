CREATE TABLE `orderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`priceCents` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`imageUrl` text NOT NULL,
	CONSTRAINT `orderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(40) NOT NULL,
	`userId` int,
	`customerName` varchar(255) NOT NULL,
	`customerEmail` varchar(320) NOT NULL,
	`shippingAddress` text,
	`totalCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'try',
	`status` enum('pending','paid','cancelled','fulfilled') NOT NULL DEFAULT 'pending',
	`stripeCheckoutSessionId` varchar(255),
	`stripePaymentIntentId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`),
	CONSTRAINT `orders_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(180) NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(100) NOT NULL,
	`era` varchar(120) NOT NULL,
	`priceCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'try',
	`shortDescription` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`condition` text NOT NULL,
	`dimensions` varchar(255),
	`imageUrl` text NOT NULL,
	`imageKey` text,
	`tag` varchar(100),
	`isAvailable` int NOT NULL DEFAULT 1,
	`isFeatured` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
