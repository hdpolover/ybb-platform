-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Nov 11, 2025 at 11:32 PM
-- Server version: 10.11.14-MariaDB-cll-lve
-- PHP Version: 8.4.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u1437096_ybb_master_app_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `abstracts`
--

CREATE TABLE `abstracts` (
  `id` int(11) NOT NULL,
  `primary_participant_id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `active_version_id` int(11) DEFAULT NULL,
  `program_subtheme_id` int(11) DEFAULT NULL,
  `status` enum('draft','submitted','under_review','accepted') NOT NULL DEFAULT 'draft',
  `is_active` int(11) NOT NULL DEFAULT 1,
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `abstract_authors`
--

CREATE TABLE `abstract_authors` (
  `id` int(11) NOT NULL,
  `abstract_id` int(11) NOT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `institution` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_active` int(11) NOT NULL DEFAULT 1,
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `is_participant` int(11) NOT NULL DEFAULT 1,
  `participant_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `abstract_feedbacks`
--

CREATE TABLE `abstract_feedbacks` (
  `id` int(11) NOT NULL,
  `abstract_version_id` int(11) NOT NULL,
  `abstract_reviewer_id` int(11) NOT NULL,
  `feedback` mediumtext DEFAULT NULL,
  `is_active` int(11) NOT NULL DEFAULT 1,
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `abstract_papers`
--

CREATE TABLE `abstract_papers` (
  `id` int(11) NOT NULL,
  `abstract_id` int(11) NOT NULL,
  `file_url` varchar(100) NOT NULL,
  `notes` varchar(100) NOT NULL,
  `status` enum('submitted','accepted','rejected','') DEFAULT NULL,
  `is_active` int(11) NOT NULL DEFAULT 1,
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `abstract_reviewers`
--

CREATE TABLE `abstract_reviewers` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `institution` varchar(100) DEFAULT NULL,
  `password` varchar(100) DEFAULT NULL,
  `role` enum('super','internal','external') NOT NULL DEFAULT 'internal',
  `is_active` int(11) NOT NULL DEFAULT 1,
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `abstract_reviewer_subthemes`
--

CREATE TABLE `abstract_reviewer_subthemes` (
  `id` int(11) NOT NULL,
  `abstract_reviewer_id` int(11) NOT NULL,
  `program_subtheme_id` int(11) NOT NULL,
  `is_active` int(11) NOT NULL DEFAULT 1,
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `abstract_settings`
--

CREATE TABLE `abstract_settings` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `title_length` int(11) DEFAULT NULL,
  `content_length` int(11) DEFAULT NULL,
  `keywords_length` int(11) DEFAULT NULL,
  `refs_length` int(11) DEFAULT NULL,
  `paper_template_url` varchar(100) DEFAULT NULL,
  `abstract_template_url` varchar(100) DEFAULT NULL,
  `abstract_submission_deadline` datetime DEFAULT NULL,
  `full_paper_submission_deadline` datetime DEFAULT NULL,
  `is_active` int(11) NOT NULL DEFAULT 1,
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `abstract_topics`
--

CREATE TABLE `abstract_topics` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `description` varchar(100) DEFAULT NULL,
  `is_active` int(11) NOT NULL DEFAULT 1,
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `abstract_versions`
--

CREATE TABLE `abstract_versions` (
  `id` int(11) NOT NULL,
  `abstract_id` int(11) NOT NULL,
  `title` mediumtext DEFAULT NULL,
  `content` mediumtext DEFAULT NULL,
  `keywords` mediumtext DEFAULT NULL,
  `refs` mediumtext DEFAULT NULL,
  `version_number` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `is_active` int(11) NOT NULL DEFAULT 1,
  `status` enum('draft','submitted') NOT NULL DEFAULT 'draft'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'news_writer',
  `role_id` int(11) UNSIGNED DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `program_id` int(11) DEFAULT NULL,
  `profile_url` varchar(255) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `timezone` varchar(50) DEFAULT 'Asia/Jakarta',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) UNSIGNED DEFAULT NULL,
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `updated_by` int(11) UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp(),
  `last_login` datetime DEFAULT NULL COMMENT 'Last login timestamp',
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Additional permissions override' CHECK (json_valid(`permissions`)),
  `access_level` tinyint(3) UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Access level: 1=basic, 2=moderate, 3=advanced, 4=super',
  `can_manage_users` tinyint(1) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Can create/edit other admins',
  `session_token` varchar(255) DEFAULT NULL COMMENT 'Current session token'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_programs`
--

CREATE TABLE `admin_programs` (
  `id` int(11) UNSIGNED NOT NULL,
  `admin_id` int(11) UNSIGNED NOT NULL,
  `program_id` int(11) UNSIGNED NOT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `assigned_by` int(11) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_roles`
--

CREATE TABLE `admin_roles` (
  `id` int(11) UNSIGNED NOT NULL,
  `name` varchar(50) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `access_level` tinyint(2) UNSIGNED DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_role_permissions`
--

CREATE TABLE `admin_role_permissions` (
  `id` int(11) UNSIGNED NOT NULL,
  `role_id` int(11) UNSIGNED NOT NULL,
  `permission_id` int(11) UNSIGNED NOT NULL,
  `granted_at` datetime DEFAULT NULL,
  `granted_by` int(11) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ambassadors`
--

CREATE TABLE `ambassadors` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `ref_code` varchar(10) DEFAULT NULL,
  `program_id` int(11) NOT NULL,
  `institution` varchar(255) NOT NULL,
  `gender` enum('male','female') NOT NULL,
  `notes` text DEFAULT NULL,
  `is_active` char(1) NOT NULL DEFAULT '1',
  `is_deleted` char(1) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ambassador_participant_referrals`
--

CREATE TABLE `ambassador_participant_referrals` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `ambassador_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `is_active` int(11) NOT NULL DEFAULT 1,
  `is_deleted` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `competition_categories`
--

CREATE TABLE `competition_categories` (
  `id` int(11) NOT NULL,
  `program_category_id` int(11) DEFAULT NULL,
  `program_id` int(11) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `desc` mediumtext DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `document_invitation`
--

CREATE TABLE `document_invitation` (
  `id` int(11) NOT NULL,
  `program_document_id` int(11) NOT NULL,
  `content` mediumtext DEFAULT NULL,
  `sincerely` varchar(100) DEFAULT NULL,
  `sign_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `email_templates`
--

CREATE TABLE `email_templates` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `file_name` varchar(100) NOT NULL,
  `is_active` tinyint(4) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `export_requests`
--

CREATE TABLE `export_requests` (
  `id` int(11) UNSIGNED NOT NULL,
  `program_id` int(11) UNSIGNED NOT NULL,
  `export_type` enum('participants','payments','ambassadors') NOT NULL,
  `user_id` int(11) UNSIGNED NOT NULL,
  `filters` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`filters`)),
  `custom_filename` varchar(255) DEFAULT NULL,
  `record_count` int(11) DEFAULT NULL,
  `status` enum('pending','success','error') NOT NULL DEFAULT 'pending',
  `export_id` varchar(255) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `file_size` int(11) DEFAULT NULL,
  `processing_time` decimal(10,3) DEFAULT NULL,
  `performance_data` text DEFAULT NULL,
  `export_strategy` varchar(50) DEFAULT 'single_file',
  `error_message` text DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `batch_processing` tinyint(1) DEFAULT 0,
  `batch_count` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `help_tickets`
--

CREATE TABLE `help_tickets` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `admin_id` int(11) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `sub_category` varchar(100) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `body` mediumtext DEFAULT NULL,
  `status` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `help_ticket_discussions`
--

CREATE TABLE `help_ticket_discussions` (
  `id` int(11) NOT NULL,
  `help_ticket_id` int(11) NOT NULL,
  `message` mediumtext DEFAULT NULL,
  `participant_id` int(11) DEFAULT NULL,
  `admin_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `loa_placeholders`
--

CREATE TABLE `loa_placeholders` (
  `id` int(11) NOT NULL,
  `letter_type` enum('journal','regular','','') NOT NULL,
  `placeholder` varchar(100) NOT NULL,
  `label` varchar(100) NOT NULL,
  `description` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_active` int(11) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `loa_templates`
--

CREATE TABLE `loa_templates` (
  `id` int(11) NOT NULL,
  `program_document_id` int(11) NOT NULL,
  `letter_type` enum('regular','journal','','') NOT NULL DEFAULT 'regular',
  `body` mediumtext NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `is_active` int(11) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `menu_items`
--

CREATE TABLE `menu_items` (
  `id` int(11) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `label` varchar(100) NOT NULL,
  `icon` varchar(50) DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  `route_name` varchar(100) DEFAULT NULL,
  `parent_id` int(11) UNSIGNED DEFAULT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `required_permission` varchar(100) DEFAULT NULL,
  `badge_text` varchar(20) DEFAULT NULL,
  `badge_color` varchar(20) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `midtrans_payment`
--

CREATE TABLE `midtrans_payment` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `payment_id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `description` mediumtext DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `currency` varchar(10) DEFAULT NULL,
  `gross_amount` double DEFAULT NULL,
  `payment_type` varchar(50) DEFAULT NULL,
  `transaction_time` datetime DEFAULT NULL,
  `status_code` char(3) DEFAULT NULL,
  `transaction_status` varchar(50) DEFAULT NULL,
  `order_id` varchar(100) DEFAULT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `bank` varchar(100) DEFAULT NULL,
  `va_number` varchar(100) DEFAULT NULL,
  `pdf_url` mediumtext DEFAULT NULL,
  `finish_redirect_url` mediumtext DEFAULT NULL,
  `expired_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `version` varchar(255) NOT NULL,
  `class` varchar(255) NOT NULL,
  `group` varchar(255) NOT NULL,
  `namespace` varchar(255) NOT NULL,
  `time` int(11) NOT NULL,
  `batch` int(11) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `oauth_tokens`
--

CREATE TABLE `oauth_tokens` (
  `id` int(11) UNSIGNED NOT NULL,
  `email` varchar(255) NOT NULL,
  `access_token` text NOT NULL,
  `refresh_token` text DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `token_type` varchar(50) NOT NULL DEFAULT 'Bearer',
  `scope` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `otp_requests`
--

CREATE TABLE `otp_requests` (
  `id` int(11) NOT NULL,
  `email` varchar(100) NOT NULL,
  `user_id` int(11) NOT NULL,
  `otp` varchar(10) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `paid_and_submitted`
-- (See below for the actual view)
--
CREATE TABLE `paid_and_submitted` (
`email` varchar(255)
,`full_name` varchar(255)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `paid_not_submitted`
-- (See below for the actual view)
--
CREATE TABLE `paid_not_submitted` (
`email` varchar(255)
,`full_name` varchar(255)
);

-- --------------------------------------------------------

--
-- Table structure for table `papers`
--

CREATE TABLE `papers` (
  `id` int(11) NOT NULL,
  `paper_url` varchar(255) DEFAULT NULL,
  `desc` mediumtext DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paper_abstracts`
--

CREATE TABLE `paper_abstracts` (
  `id` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `content` mediumtext DEFAULT NULL,
  `keywords` varchar(255) DEFAULT NULL,
  `status` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paper_authors`
--

CREATE TABLE `paper_authors` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) DEFAULT NULL,
  `paper_detail_id` int(11) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `institution` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `is_participant` tinyint(1) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paper_details`
--

CREATE TABLE `paper_details` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `paper_abstract_id` int(11) DEFAULT NULL,
  `paper_topic_id` int(11) DEFAULT NULL,
  `paper_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paper_program_details`
--

CREATE TABLE `paper_program_details` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `topics` mediumtext DEFAULT NULL,
  `topic_img_url` varchar(255) DEFAULT NULL,
  `paper_format` mediumtext DEFAULT NULL,
  `committees` mediumtext DEFAULT NULL,
  `committee_img_url` varchar(255) DEFAULT NULL,
  `books` text DEFAULT NULL,
  `timeline` mediumtext DEFAULT NULL,
  `contact_us` mediumtext DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paper_reviewers`
--

CREATE TABLE `paper_reviewers` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `institution` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paper_reviewer_topics`
--

CREATE TABLE `paper_reviewer_topics` (
  `id` int(11) NOT NULL,
  `paper_reviewer_id` int(11) NOT NULL,
  `paper_topic_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `is_active` tinyint(11) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(4) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paper_revisions`
--

CREATE TABLE `paper_revisions` (
  `id` int(11) NOT NULL,
  `paper_detail_id` int(11) NOT NULL,
  `paper_reviewer_id` int(11) NOT NULL,
  `comment` mediumtext DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paper_topics`
--

CREATE TABLE `paper_topics` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `topic_name` varchar(100) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `participants`
--

CREATE TABLE `participants` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `account_id` varchar(255) NOT NULL COMMENT 'uid',
  `full_name` varchar(255) NOT NULL,
  `birthdate` date DEFAULT NULL,
  `ref_code_ambassador` varchar(10) DEFAULT NULL,
  `program_id` int(11) NOT NULL,
  `gender` enum('male','female','prefer-not','other') NOT NULL COMMENT '''male'',''female''',
  `origin_address` text DEFAULT NULL,
  `current_address` text DEFAULT NULL,
  `nationality` varchar(100) DEFAULT NULL,
  `nationality_flag` varchar(10) DEFAULT NULL,
  `nationality_code` varchar(100) DEFAULT NULL,
  `occupation` varchar(100) DEFAULT NULL,
  `institution` varchar(100) DEFAULT NULL,
  `major` varchar(100) DEFAULT NULL,
  `organizations` varchar(100) DEFAULT NULL,
  `country_code` varchar(10) DEFAULT NULL,
  `phone_flag` varchar(10) NOT NULL,
  `phone_number` varchar(25) DEFAULT NULL,
  `picture_url` varchar(255) DEFAULT NULL,
  `instagram_account` varchar(50) DEFAULT NULL,
  `emergency_account` varchar(50) DEFAULT NULL,
  `emergency_country_code` varchar(10) DEFAULT NULL,
  `emergency_phone_flag` varchar(10) NOT NULL,
  `contact_relation` varchar(50) DEFAULT NULL,
  `disease_history` text DEFAULT NULL,
  `tshirt_size` varchar(10) DEFAULT NULL,
  `category` enum('fully_funded','self_funded') DEFAULT 'fully_funded',
  `experiences` text DEFAULT NULL,
  `achievements` text DEFAULT NULL,
  `resume_url` text DEFAULT NULL,
  `education_level` varchar(100) DEFAULT NULL,
  `knowledge_source` varchar(50) DEFAULT NULL,
  `source_account_name` varchar(100) DEFAULT NULL,
  `twibbon_link` text DEFAULT NULL,
  `requirement_link` text DEFAULT NULL,
  `score_total` decimal(5,2) DEFAULT NULL,
  `score_status` enum('go_to_interview','rejected','no_score') DEFAULT 'no_score',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `participant_agreement_letters`
--

CREATE TABLE `participant_agreement_letters` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) DEFAULT NULL,
  `file_link` varchar(255) DEFAULT NULL,
  `is_active` tinyint(4) DEFAULT 1,
  `is_deleted` tinyint(4) DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `participant_awards`
--

CREATE TABLE `participant_awards` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `award_id` int(11) NOT NULL,
  `assigned_by` int(11) DEFAULT NULL,
  `assigned_at` datetime DEFAULT current_timestamp(),
  `notes` mediumtext DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `participant_certificates`
--

CREATE TABLE `participant_certificates` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `award_id` int(11) NOT NULL,
  `certificate_id` int(11) NOT NULL,
  `generated_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `participant_competition_categories`
--

CREATE TABLE `participant_competition_categories` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `competition_category_id` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `participant_essays`
--

CREATE TABLE `participant_essays` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `program_essay_id` int(11) NOT NULL,
  `answer` mediumtext DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `participant_program_documents`
--

CREATE TABLE `participant_program_documents` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `program_document_id` int(11) NOT NULL,
  `file_url` varchar(255) DEFAULT NULL,
  `status` enum('under_review','accepted','rejected','') NOT NULL DEFAULT 'under_review',
  `notes` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `participant_statuses`
--

CREATE TABLE `participant_statuses` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `general_status` int(11) DEFAULT 0 COMMENT '0=registration progress, 1=submitted form, 2= payment batch 1 submit, 3: payment batch 2 submit, 4: complete all and attend event',
  `form_status` int(11) DEFAULT 0 COMMENT '0 (not started), 1 (progress), 2 (submitted)',
  `document_status` int(11) DEFAULT 0,
  `payment_status` int(11) DEFAULT 0 COMMENT '0 (not paid), 1 (regist_paid), 2 (batch 1 paid), 3 (batch 2 paid)\n',
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `participant_subthemes`
--

CREATE TABLE `participant_subthemes` (
  `id` int(11) NOT NULL,
  `program_subtheme_id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `participant_testimonies`
--

CREATE TABLE `participant_testimonies` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `testimony` mediumtext NOT NULL,
  `rating` int(11) NOT NULL DEFAULT 5,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `program_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_resets`
--

CREATE TABLE `password_resets` (
  `id` int(11) UNSIGNED NOT NULL,
  `user_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` int(11) NOT NULL,
  `transaction_code` varchar(100) DEFAULT NULL,
  `order_id` varchar(50) DEFAULT NULL,
  `participant_id` int(11) NOT NULL,
  `program_payment_id` int(11) NOT NULL,
  `payment_method_id` int(11) DEFAULT NULL,
  `payment_url` varchar(200) DEFAULT NULL,
  `payment_date` datetime DEFAULT NULL,
  `status` int(11) NOT NULL DEFAULT 0 COMMENT '(0: created, 1: pending, 2: success, 3: cancelled, 4: rejected),',
  `proof_url` varchar(500) DEFAULT NULL,
  `account_name` varchar(100) DEFAULT NULL,
  `amount` double DEFAULT NULL,
  `usd_amount` double DEFAULT NULL,
  `currency` varchar(50) DEFAULT NULL,
  `source_name` varchar(100) DEFAULT NULL,
  `notes` mediumtext DEFAULT NULL,
  `rejection_reason` mediumtext DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_methods`
--

CREATE TABLE `payment_methods` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `type` enum('manual','gateway') DEFAULT 'manual',
  `img_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` int(11) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `display_name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(50) DEFAULT 'general',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `programs`
--

CREATE TABLE `programs` (
  `id` int(11) NOT NULL,
  `program_category_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `banner_url` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `guideline` varchar(255) DEFAULT NULL,
  `main_essay_question` text NOT NULL,
  `essay_guideline_url` varchar(100) NOT NULL,
  `twibbon` varchar(255) DEFAULT NULL,
  `twibbon_video_url` text DEFAULT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `registration_video_url` varchar(255) DEFAULT NULL,
  `tshirt_chart_url` text DEFAULT NULL,
  `theme` varchar(255) DEFAULT NULL,
  `share_desc` text DEFAULT NULL,
  `confirmation_desc` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_registration_open` int(11) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_announcements`
--

CREATE TABLE `program_announcements` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `content` text DEFAULT NULL,
  `img_url` varchar(255) DEFAULT NULL,
  `visible_to` int(11) NOT NULL DEFAULT 1 COMMENT '1: public. 2: participant, 3: program participant',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `slug` varchar(255) NOT NULL,
  `meta_title` varchar(255) NOT NULL,
  `meta_description` varchar(255) NOT NULL,
  `tags` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_awards`
--

CREATE TABLE `program_awards` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` mediumtext DEFAULT NULL,
  `award_type` enum('winner','runner_up','mention','other') DEFAULT 'winner',
  `order_number` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_categories`
--

CREATE TABLE `program_categories` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `about` text NOT NULL,
  `core_values` text NOT NULL,
  `objectives` text NOT NULL,
  `benefits` text NOT NULL,
  `program_type_id` int(11) DEFAULT NULL,
  `web_url` varchar(255) DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `main_banner_url` varchar(100) DEFAULT NULL,
  `main_video_url` varchar(100) DEFAULT NULL,
  `tagline` varchar(255) DEFAULT NULL,
  `contact` varchar(50) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `instagram` varchar(255) DEFAULT NULL,
  `tiktok` varchar(255) DEFAULT NULL,
  `youtube` varchar(255) DEFAULT NULL,
  `telegram` varchar(255) DEFAULT NULL,
  `sponsor_url` varchar(250) NOT NULL,
  `verification_required` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_certificates`
--

CREATE TABLE `program_certificates` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `award_id` int(11) NOT NULL,
  `template_url` varchar(512) NOT NULL,
  `template_type` enum('image','pdf') NOT NULL DEFAULT 'image',
  `preview_url` mediumtext DEFAULT NULL,
  `issue_date` date NOT NULL,
  `published_at` datetime NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_certificate_content_blocks`
--

CREATE TABLE `program_certificate_content_blocks` (
  `id` int(11) NOT NULL,
  `certificate_id` int(11) NOT NULL,
  `type` enum('text','placeholder') NOT NULL,
  `value` mediumtext NOT NULL,
  `x` int(11) NOT NULL,
  `y` int(11) NOT NULL,
  `font_size` int(11) DEFAULT 16,
  `font_family` varchar(100) DEFAULT 'Arial',
  `font_weight` enum('normal','bold') DEFAULT 'normal',
  `text_align` enum('left','center','right') DEFAULT 'left',
  `color` varchar(10) DEFAULT '#000000',
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_documents`
--

CREATE TABLE `program_documents` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `type` enum('loa','agreement','complement','') NOT NULL DEFAULT 'complement',
  `file_url` varchar(255) DEFAULT NULL,
  `drive_url` mediumtext DEFAULT NULL,
  `desc` mediumtext DEFAULT NULL,
  `is_upload` tinyint(1) DEFAULT 0,
  `is_generated` int(11) NOT NULL,
  `visibility` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_document_settings`
--

CREATE TABLE `program_document_settings` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `availability_date` datetime DEFAULT NULL,
  `custom_availability` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_essays`
--

CREATE TABLE `program_essays` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `questions` mediumtext DEFAULT NULL,
  `max_word_count` int(11) NOT NULL DEFAULT 100,
  `is_answerable` int(11) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_faqs`
--

CREATE TABLE `program_faqs` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `question` varchar(255) NOT NULL,
  `answer` text NOT NULL,
  `faq_category` enum('event_details','registration','payments') NOT NULL COMMENT '''event_details'',''registration'',''payments''',
  `order_number` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_loas`
--

CREATE TABLE `program_loas` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `template_name` varchar(100) NOT NULL,
  `template_path` varchar(100) NOT NULL,
  `required_fields` varchar(255) NOT NULL,
  `description` varchar(100) NOT NULL,
  `is_active` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_payments`
--

CREATE TABLE `program_payments` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `order_number` int(11) NOT NULL,
  `idr_amount` double(10,2) NOT NULL,
  `usd_amount` double(10,2) NOT NULL,
  `category` enum('registration','program_fee_1','program_fee_2') NOT NULL COMMENT '("registration", "progam_fee")',
  `type` enum('all','self_funded','fully_funded') DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_payment_periods`
--

CREATE TABLE `program_payment_periods` (
  `id` int(11) UNSIGNED NOT NULL,
  `payment_id` int(11) NOT NULL,
  `parent_period_id` int(11) UNSIGNED DEFAULT NULL,
  `extension_type` enum('continuation','parallel') DEFAULT 'continuation',
  `name` varchar(255) NOT NULL COMMENT 'Period name for admin identification (e.g., Main Registration, Extension, Final Extension)',
  `description` text DEFAULT NULL COMMENT 'Optional description for the period',
  `start_date` datetime NOT NULL COMMENT 'Period start date and time',
  `end_date` datetime NOT NULL COMMENT 'Period end date and time',
  `order_number` int(11) NOT NULL DEFAULT 1 COMMENT 'Display order for periods (1, 2, 3, etc.)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this period is active (1) or inactive (0)',
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Soft delete flag (0 = active, 1 = deleted)',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_photos`
--

CREATE TABLE `program_photos` (
  `id` int(11) NOT NULL,
  `program_category_id` int(11) NOT NULL,
  `title` varchar(100) NOT NULL,
  `year` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `img_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_rundowns`
--

CREATE TABLE `program_rundowns` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` mediumtext DEFAULT NULL,
  `order_number` int(11) NOT NULL DEFAULT 0,
  `is_active` int(11) NOT NULL DEFAULT 1,
  `is_deleted` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_schedules`
--

CREATE TABLE `program_schedules` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `order_number` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_speakers`
--

CREATE TABLE `program_speakers` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `photo_url` mediumtext DEFAULT NULL,
  `linkedin_url` varchar(500) DEFAULT NULL,
  `instagram_url` varchar(500) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `expertise_areas` text DEFAULT NULL,
  `is_keynote` tinyint(1) NOT NULL DEFAULT 0,
  `session_title` varchar(500) DEFAULT NULL,
  `session_description` text DEFAULT NULL,
  `session_time` datetime DEFAULT NULL,
  `order_number` int(11) NOT NULL DEFAULT 0,
  `name` varchar(255) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_sponsors`
--

CREATE TABLE `program_sponsors` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `img_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_subthemes`
--

CREATE TABLE `program_subthemes` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `desc` mediumtext DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_testimonies`
--

CREATE TABLE `program_testimonies` (
  `id` int(11) NOT NULL,
  `program_category_id` int(11) DEFAULT NULL,
  `person_name` varchar(255) DEFAULT NULL,
  `testimony` text DEFAULT NULL,
  `occupation` varchar(255) DEFAULT NULL,
  `institution` varchar(255) DEFAULT NULL,
  `img_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_types`
--

CREATE TABLE `program_types` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` char(1) NOT NULL DEFAULT '1',
  `is_deleted` char(1) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `program_video_testimonies`
--

CREATE TABLE `program_video_testimonies` (
  `id` int(11) UNSIGNED NOT NULL,
  `program_id` int(11) UNSIGNED NOT NULL COMMENT 'Foreign key to programs table',
  `youtube_url` text NOT NULL COMMENT 'YouTube video URL for the testimony',
  `youtube_video_id` varchar(50) DEFAULT NULL COMMENT 'Extracted YouTube video ID for easier embedding',
  `description` text DEFAULT NULL COMMENT 'Description of the video testimony',
  `display_order` int(11) NOT NULL DEFAULT 0 COMMENT 'Order for displaying videos',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1 = active, 0 = inactive',
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = deleted, 0 = not deleted',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `scores`
--

CREATE TABLE `scores` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `score_weight_id` int(11) NOT NULL,
  `score_input` decimal(6,2) NOT NULL,
  `score_calculated` decimal(8,2) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `score_weights`
--

CREATE TABLE `score_weights` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `description` varchar(255) NOT NULL,
  `reference` varchar(100) NOT NULL,
  `weight` decimal(5,2) NOT NULL DEFAULT 0.00,
  `weight2` double(5,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `is_verified` tinyint(1) NOT NULL DEFAULT 0,
  `verification_token` varchar(255) DEFAULT NULL,
  `program_category_id` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `web_settings`
--

CREATE TABLE `web_settings` (
  `id` int(11) NOT NULL,
  `program_category_id` int(11) NOT NULL,
  `is_maintenance_mode` int(11) NOT NULL DEFAULT 0,
  `is_verification_required` int(11) NOT NULL DEFAULT 0,
  `usd_in_idr` double NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `web_setting_about`
--

CREATE TABLE `web_setting_about` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `page_name` varchar(100) DEFAULT NULL,
  `menu_path` varchar(100) DEFAULT NULL,
  `about_ybb` text DEFAULT NULL,
  `about_program` text DEFAULT NULL,
  `why_program` text DEFAULT NULL,
  `what_program` text DEFAULT NULL,
  `ybb_video_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `web_setting_home`
--

CREATE TABLE `web_setting_home` (
  `id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `page_name` varchar(100) DEFAULT NULL,
  `menu_path` varchar(100) DEFAULT NULL,
  `banner1_img_url` varchar(255) DEFAULT NULL,
  `banner1_mobile_img_url` varchar(255) DEFAULT NULL,
  `banner1_title` varchar(100) DEFAULT NULL,
  `banner1_description` varchar(255) DEFAULT NULL,
  `banner1_date` varchar(100) DEFAULT NULL,
  `banner2_img_url` varchar(255) DEFAULT NULL,
  `banner2_mobile_img_url` varchar(255) DEFAULT NULL,
  `banner2_title` varchar(100) DEFAULT NULL,
  `banner2_description` varchar(255) DEFAULT NULL,
  `banner2_date` varchar(100) DEFAULT NULL,
  `summary` text DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `agenda` text DEFAULT NULL,
  `introduction` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `xendit_payment`
--

CREATE TABLE `xendit_payment` (
  `id` int(11) NOT NULL,
  `participant_id` int(11) NOT NULL,
  `payment_id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `description` mediumtext DEFAULT NULL,
  `amount` double DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `external_id` varchar(50) NOT NULL,
  `currency` varchar(10) DEFAULT 'IDR',
  `id_xendit` varchar(100) NOT NULL,
  `user_id_xendit` varchar(100) DEFAULT NULL,
  `url_xendit` mediumtext DEFAULT NULL,
  `status` varchar(25) DEFAULT NULL,
  `merchant_name` varchar(100) DEFAULT NULL,
  `expired_at` datetime DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `abstracts`
--
ALTER TABLE `abstracts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_primary_pr_id` (`primary_participant_id`),
  ADD KEY `fk_prohram_id_absr` (`program_id`),
  ADD KEY `fk_active_version_id` (`active_version_id`),
  ADD KEY `fk_selected_subtheem_id` (`program_subtheme_id`);

--
-- Indexes for table `abstract_authors`
--
ALTER TABLE `abstract_authors`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_author_abstract_id` (`abstract_id`),
  ADD KEY `fk_part_id_author` (`participant_id`);

--
-- Indexes for table `abstract_feedbacks`
--
ALTER TABLE `abstract_feedbacks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_abstract_version_id` (`abstract_version_id`),
  ADD KEY `fk_abst_reviewer_id` (`abstract_reviewer_id`);

--
-- Indexes for table `abstract_papers`
--
ALTER TABLE `abstract_papers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_paper_abst_id` (`abstract_id`);

--
-- Indexes for table `abstract_reviewers`
--
ALTER TABLE `abstract_reviewers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_rev_prog_id_ab` (`program_id`);

--
-- Indexes for table `abstract_reviewer_subthemes`
--
ALTER TABLE `abstract_reviewer_subthemes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_reviewe_abs_sub_id` (`abstract_reviewer_id`),
  ADD KEY `fk_sub_prog_rev_id` (`program_subtheme_id`);

--
-- Indexes for table `abstract_settings`
--
ALTER TABLE `abstract_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_set_absrtact_id` (`program_id`);

--
-- Indexes for table `abstract_topics`
--
ALTER TABLE `abstract_topics`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_topic_program_id` (`program_id`);

--
-- Indexes for table `abstract_versions`
--
ALTER TABLE `abstract_versions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_version_per_abstract` (`abstract_id`,`version_number`);

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_admins_program_id` (`program_id`),
  ADD KEY `idx_role_active` (`role`,`is_active`),
  ADD KEY `idx_access_level` (`access_level`),
  ADD KEY `idx_last_login` (`last_login`),
  ADD KEY `fk_admins_admin_roles` (`role_id`);

--
-- Indexes for table `admin_programs`
--
ALTER TABLE `admin_programs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `admin_program_unique` (`admin_id`,`program_id`);

--
-- Indexes for table `admin_roles`
--
ALTER TABLE `admin_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `admin_role_permissions`
--
ALTER TABLE `admin_role_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `role_permission_unique` (`role_id`,`permission_id`);

--
-- Indexes for table `ambassadors`
--
ALTER TABLE `ambassadors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ref_code_UNIQUE` (`ref_code`),
  ADD KEY `fk_ambassador_program_id` (`program_id`);

--
-- Indexes for table `ambassador_participant_referrals`
--
ALTER TABLE `ambassador_participant_referrals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_amb_part_refid` (`participant_id`),
  ADD KEY `fk_amb_part_ref_id` (`ambassador_id`);

--
-- Indexes for table `competition_categories`
--
ALTER TABLE `competition_categories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_compcategories_progcategory_id_idx` (`program_category_id`),
  ADD KEY `fk_pro_da_id` (`program_id`);

--
-- Indexes for table `document_invitation`
--
ALTER TABLE `document_invitation`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_document_invitation_program_document_id` (`program_document_id`);

--
-- Indexes for table `email_templates`
--
ALTER TABLE `email_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_email_template_id` (`program_id`);

--
-- Indexes for table `export_requests`
--
ALTER TABLE `export_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `program_id_user_id` (`program_id`,`user_id`),
  ADD KEY `status` (`status`),
  ADD KEY `created_at` (`created_at`);

--
-- Indexes for table `help_tickets`
--
ALTER TABLE `help_tickets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_helptickets_participant_idx` (`participant_id`),
  ADD KEY `fk_helptickets_admin_idx` (`admin_id`);

--
-- Indexes for table `help_ticket_discussions`
--
ALTER TABLE `help_ticket_discussions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_helpticketdiscussions_helpticket_idx` (`help_ticket_id`),
  ADD KEY `fk_helpticketdiscussions_participant_idx` (`participant_id`),
  ADD KEY `fk_helpticketdiscussions_admin_idx` (`admin_id`);

--
-- Indexes for table `loa_placeholders`
--
ALTER TABLE `loa_placeholders`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `loa_templates`
--
ALTER TABLE `loa_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_doc_loa_id` (`program_document_id`);

--
-- Indexes for table `menu_items`
--
ALTER TABLE `menu_items`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `midtrans_payment`
--
ALTER TABLE `midtrans_payment`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_midtrans_participant_id` (`participant_id`),
  ADD KEY `fk_midtrans_program_id` (`program_id`),
  ADD KEY `fk_midtrans_payment_id` (`payment_id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `oauth_tokens`
--
ALTER TABLE `oauth_tokens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `email` (`email`);

--
-- Indexes for table `otp_requests`
--
ALTER TABLE `otp_requests`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `papers`
--
ALTER TABLE `papers`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `paper_abstracts`
--
ALTER TABLE `paper_abstracts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `paper_authors`
--
ALTER TABLE `paper_authors`
  ADD PRIMARY KEY (`id`),
  ADD KEY `paper_authors_participant_idx` (`participant_id`),
  ADD KEY `paper_authors_paper_detail_idx` (`paper_detail_id`);

--
-- Indexes for table `paper_details`
--
ALTER TABLE `paper_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `paper_details_program_idx` (`program_id`),
  ADD KEY `paper_details_paper_abstract_idx` (`paper_abstract_id`),
  ADD KEY `paper_topic_id` (`paper_topic_id`);

--
-- Indexes for table `paper_program_details`
--
ALTER TABLE `paper_program_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_paper_program_details_program_idx` (`program_id`);

--
-- Indexes for table `paper_reviewers`
--
ALTER TABLE `paper_reviewers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_paper_reviewers_program` (`program_id`);

--
-- Indexes for table `paper_reviewer_topics`
--
ALTER TABLE `paper_reviewer_topics`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_topic_id` (`paper_topic_id`),
  ADD KEY `fk_reviewer_id` (`paper_reviewer_id`);

--
-- Indexes for table `paper_revisions`
--
ALTER TABLE `paper_revisions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_paper_revisions_paper_detail_idx` (`paper_detail_id`) USING BTREE,
  ADD KEY `fk_paper_reviewer_id` (`paper_reviewer_id`);

--
-- Indexes for table `paper_topics`
--
ALTER TABLE `paper_topics`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_program_id` (`program_id`);

--
-- Indexes for table `participants`
--
ALTER TABLE `participants`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_participants_program_id` (`program_id`),
  ADD KEY `fk_participans_user_id` (`user_id`),
  ADD KEY `fk_participans_ambassador_ref_idx` (`ref_code_ambassador`),
  ADD KEY `fk_participants_ambassador_ref_idx` (`ref_code_ambassador`),
  ADD KEY `idx_participants_export_main` (`program_id`,`is_deleted`,`id`),
  ADD KEY `idx_participants_category_filter` (`program_id`,`category`,`is_deleted`),
  ADD KEY `idx_participants_date_filter` (`program_id`,`created_at`,`is_deleted`),
  ADD KEY `idx_participants_user_lookup` (`user_id`),
  ADD KEY `idx_participants_full_export` (`program_id`,`is_deleted`,`category`,`created_at`);

--
-- Indexes for table `participant_agreement_letters`
--
ALTER TABLE `participant_agreement_letters`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_agreement_letter_participant_id` (`participant_id`);

--
-- Indexes for table `participant_awards`
--
ALTER TABLE `participant_awards`
  ADD PRIMARY KEY (`id`),
  ADD KEY `participant_id` (`participant_id`),
  ADD KEY `award_id` (`award_id`),
  ADD KEY `fl_assign_by_award_id` (`assigned_by`);

--
-- Indexes for table `participant_certificates`
--
ALTER TABLE `participant_certificates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `participant_id` (`participant_id`),
  ADD KEY `award_id` (`award_id`),
  ADD KEY `certificate_id` (`certificate_id`);

--
-- Indexes for table `participant_competition_categories`
--
ALTER TABLE `participant_competition_categories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_partcompcategories_participants_id_idx` (`participant_id`),
  ADD KEY `fk_partcompcategories_compcategory_id_idx` (`competition_category_id`);

--
-- Indexes for table `participant_essays`
--
ALTER TABLE `participant_essays`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_partessays_participants_id_idx` (`participant_id`),
  ADD KEY `fk_partessays_progessays_id_idx` (`program_essay_id`),
  ADD KEY `idx_participant_essays_export` (`participant_id`,`program_essay_id`,`is_deleted`),
  ADD KEY `idx_essays_comprehensive` (`participant_id`,`program_essay_id`,`is_deleted`);

--
-- Indexes for table `participant_program_documents`
--
ALTER TABLE `participant_program_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_partprogramdocuments_participant_id_idx` (`participant_id`),
  ADD KEY `fk_partprogramdocuments_program_document_id_idx` (`program_document_id`);

--
-- Indexes for table `participant_statuses`
--
ALTER TABLE `participant_statuses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_partstatuses_participant_id_idx` (`participant_id`),
  ADD KEY `idx_participant_statuses_batch` (`participant_id`),
  ADD KEY `idx_participant_statuses_filters` (`form_status`,`payment_status`,`general_status`),
  ADD KEY `idx_status_comprehensive` (`participant_id`,`form_status`,`payment_status`,`general_status`);

--
-- Indexes for table `participant_subthemes`
--
ALTER TABLE `participant_subthemes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_partsubthemes_progsubtheme_id_idx` (`program_subtheme_id`),
  ADD KEY `fk_partsubthemes_participant_id_idx` (`participant_id`);

--
-- Indexes for table `participant_testimonies`
--
ALTER TABLE `participant_testimonies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_par_test_id` (`participant_id`),
  ADD KEY `fk_prog_test_id` (`program_id`);

--
-- Indexes for table `password_resets`
--
ALTER TABLE `password_resets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `email` (`email`),
  ADD KEY `token` (`token`),
  ADD KEY `fk_user_pass_reset` (`user_id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_payments_participant_id_idx` (`participant_id`),
  ADD KEY `fk_payments_program_payment_id_idx` (`program_payment_id`),
  ADD KEY `fk_payments_payment_method_id_idx` (`payment_method_id`);

--
-- Indexes for table `payment_methods`
--
ALTER TABLE `payment_methods`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_payment_methods_program_id` (`program_id`);

--
-- Indexes for table `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `programs`
--
ALTER TABLE `programs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_program_category_id` (`program_category_id`);

--
-- Indexes for table `program_announcements`
--
ALTER TABLE `program_announcements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_program_announcements_program_id` (`program_id`);

--
-- Indexes for table `program_awards`
--
ALTER TABLE `program_awards`
  ADD PRIMARY KEY (`id`),
  ADD KEY `program_id` (`program_id`);

--
-- Indexes for table `program_categories`
--
ALTER TABLE `program_categories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_program_categories_program_type` (`program_type_id`);

--
-- Indexes for table `program_certificates`
--
ALTER TABLE `program_certificates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `program_id` (`program_id`),
  ADD KEY `award_id` (`award_id`);

--
-- Indexes for table `program_certificate_content_blocks`
--
ALTER TABLE `program_certificate_content_blocks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `certificate_id` (`certificate_id`);

--
-- Indexes for table `program_documents`
--
ALTER TABLE `program_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_progdocuments_program_id_idx` (`program_id`);

--
-- Indexes for table `program_document_settings`
--
ALTER TABLE `program_document_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `FK_program_document_settings_programs` (`program_id`);

--
-- Indexes for table `program_essays`
--
ALTER TABLE `program_essays`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_progessays_program_id_idx` (`program_id`),
  ADD KEY `idx_program_essays_active` (`program_id`,`is_active`,`is_deleted`,`id`);

--
-- Indexes for table `program_faqs`
--
ALTER TABLE `program_faqs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_program_faqs_program_id` (`program_id`);

--
-- Indexes for table `program_loas`
--
ALTER TABLE `program_loas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_loa_program_id` (`program_id`);

--
-- Indexes for table `program_payments`
--
ALTER TABLE `program_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_program_payments_program_id` (`program_id`);

--
-- Indexes for table `program_payment_periods`
--
ALTER TABLE `program_payment_periods`
  ADD PRIMARY KEY (`id`),
  ADD KEY `payment_id` (`payment_id`),
  ADD KEY `payment_id_is_active_is_deleted` (`payment_id`,`is_active`,`is_deleted`),
  ADD KEY `start_date_end_date` (`start_date`,`end_date`),
  ADD KEY `order_number` (`order_number`),
  ADD KEY `idx_parent_period` (`parent_period_id`);

--
-- Indexes for table `program_photos`
--
ALTER TABLE `program_photos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_program_photos_program_category_id` (`program_category_id`);

--
-- Indexes for table `program_rundowns`
--
ALTER TABLE `program_rundowns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_rundown_program_id` (`program_id`);

--
-- Indexes for table `program_schedules`
--
ALTER TABLE `program_schedules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_program_schedules_program_id` (`program_id`);

--
-- Indexes for table `program_speakers`
--
ALTER TABLE `program_speakers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_program_speakers_program_idx` (`program_id`);

--
-- Indexes for table `program_sponsors`
--
ALTER TABLE `program_sponsors`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_program_sponsors_program_id` (`program_id`);

--
-- Indexes for table `program_subthemes`
--
ALTER TABLE `program_subthemes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_progsubthemes_program_id_idx` (`program_id`);

--
-- Indexes for table `program_testimonies`
--
ALTER TABLE `program_testimonies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_program_testimonies_program_id` (`program_category_id`);

--
-- Indexes for table `program_types`
--
ALTER TABLE `program_types`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `program_video_testimonies`
--
ALTER TABLE `program_video_testimonies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `program_id` (`program_id`),
  ADD KEY `is_active_is_deleted` (`is_active`,`is_deleted`),
  ADD KEY `display_order` (`display_order`);

--
-- Indexes for table `scores`
--
ALTER TABLE `scores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_es_participant` (`participant_id`),
  ADD KEY `fk_es_weight` (`score_weight_id`);

--
-- Indexes for table `score_weights`
--
ALTER TABLE `score_weights`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_users_program_category_id` (`program_category_id`);

--
-- Indexes for table `web_settings`
--
ALTER TABLE `web_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_setting_web_id` (`program_category_id`);

--
-- Indexes for table `web_setting_about`
--
ALTER TABLE `web_setting_about`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_setting_about_program_id` (`program_id`);

--
-- Indexes for table `web_setting_home`
--
ALTER TABLE `web_setting_home`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_setting_home_program_id` (`program_id`);

--
-- Indexes for table `xendit_payment`
--
ALTER TABLE `xendit_payment`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_xenditpayment_participant_idx` (`participant_id`),
  ADD KEY `fk_xenditpayment_programs_idx` (`program_id`),
  ADD KEY `fk_xenditpayment_payment_idx` (`payment_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `abstracts`
--
ALTER TABLE `abstracts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `abstract_authors`
--
ALTER TABLE `abstract_authors`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `abstract_feedbacks`
--
ALTER TABLE `abstract_feedbacks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `abstract_papers`
--
ALTER TABLE `abstract_papers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `abstract_reviewers`
--
ALTER TABLE `abstract_reviewers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `abstract_reviewer_subthemes`
--
ALTER TABLE `abstract_reviewer_subthemes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `abstract_settings`
--
ALTER TABLE `abstract_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `abstract_topics`
--
ALTER TABLE `abstract_topics`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `abstract_versions`
--
ALTER TABLE `abstract_versions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `admin_programs`
--
ALTER TABLE `admin_programs`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `admin_roles`
--
ALTER TABLE `admin_roles`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `admin_role_permissions`
--
ALTER TABLE `admin_role_permissions`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ambassadors`
--
ALTER TABLE `ambassadors`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ambassador_participant_referrals`
--
ALTER TABLE `ambassador_participant_referrals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `competition_categories`
--
ALTER TABLE `competition_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `document_invitation`
--
ALTER TABLE `document_invitation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `email_templates`
--
ALTER TABLE `email_templates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `export_requests`
--
ALTER TABLE `export_requests`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `help_tickets`
--
ALTER TABLE `help_tickets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `help_ticket_discussions`
--
ALTER TABLE `help_ticket_discussions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `loa_placeholders`
--
ALTER TABLE `loa_placeholders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `loa_templates`
--
ALTER TABLE `loa_templates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `menu_items`
--
ALTER TABLE `menu_items`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `midtrans_payment`
--
ALTER TABLE `midtrans_payment`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `oauth_tokens`
--
ALTER TABLE `oauth_tokens`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `otp_requests`
--
ALTER TABLE `otp_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `papers`
--
ALTER TABLE `papers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paper_abstracts`
--
ALTER TABLE `paper_abstracts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paper_authors`
--
ALTER TABLE `paper_authors`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paper_details`
--
ALTER TABLE `paper_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paper_program_details`
--
ALTER TABLE `paper_program_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paper_reviewers`
--
ALTER TABLE `paper_reviewers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paper_reviewer_topics`
--
ALTER TABLE `paper_reviewer_topics`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paper_revisions`
--
ALTER TABLE `paper_revisions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paper_topics`
--
ALTER TABLE `paper_topics`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `participants`
--
ALTER TABLE `participants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `participant_agreement_letters`
--
ALTER TABLE `participant_agreement_letters`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `participant_awards`
--
ALTER TABLE `participant_awards`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `participant_certificates`
--
ALTER TABLE `participant_certificates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `participant_competition_categories`
--
ALTER TABLE `participant_competition_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `participant_essays`
--
ALTER TABLE `participant_essays`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `participant_program_documents`
--
ALTER TABLE `participant_program_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `participant_statuses`
--
ALTER TABLE `participant_statuses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `participant_subthemes`
--
ALTER TABLE `participant_subthemes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `participant_testimonies`
--
ALTER TABLE `participant_testimonies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `password_resets`
--
ALTER TABLE `password_resets`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_methods`
--
ALTER TABLE `payment_methods`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `programs`
--
ALTER TABLE `programs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_announcements`
--
ALTER TABLE `program_announcements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_awards`
--
ALTER TABLE `program_awards`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_categories`
--
ALTER TABLE `program_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_certificates`
--
ALTER TABLE `program_certificates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_certificate_content_blocks`
--
ALTER TABLE `program_certificate_content_blocks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_documents`
--
ALTER TABLE `program_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_document_settings`
--
ALTER TABLE `program_document_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_essays`
--
ALTER TABLE `program_essays`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_faqs`
--
ALTER TABLE `program_faqs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_loas`
--
ALTER TABLE `program_loas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_payments`
--
ALTER TABLE `program_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_payment_periods`
--
ALTER TABLE `program_payment_periods`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_photos`
--
ALTER TABLE `program_photos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_rundowns`
--
ALTER TABLE `program_rundowns`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_schedules`
--
ALTER TABLE `program_schedules`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_speakers`
--
ALTER TABLE `program_speakers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_sponsors`
--
ALTER TABLE `program_sponsors`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_subthemes`
--
ALTER TABLE `program_subthemes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_testimonies`
--
ALTER TABLE `program_testimonies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_types`
--
ALTER TABLE `program_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_video_testimonies`
--
ALTER TABLE `program_video_testimonies`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `scores`
--
ALTER TABLE `scores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `score_weights`
--
ALTER TABLE `score_weights`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `web_settings`
--
ALTER TABLE `web_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `web_setting_about`
--
ALTER TABLE `web_setting_about`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `web_setting_home`
--
ALTER TABLE `web_setting_home`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `xendit_payment`
--
ALTER TABLE `xendit_payment`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

-- --------------------------------------------------------

--
-- Structure for view `paid_and_submitted`
--
DROP TABLE IF EXISTS `paid_and_submitted`;

CREATE ALGORITHM=UNDEFINED DEFINER=`u1437096`@`localhost` SQL SECURITY DEFINER VIEW `paid_and_submitted`  AS SELECT `a`.`email` AS `email`, `a`.`full_name` AS `full_name` FROM ((`users` `a` join `payments` `b`) join `participant_statuses` `c`) WHERE `a`.`id` = `b`.`participant_id` AND `c`.`participant_id` = `a`.`id` AND `b`.`status` = 2 AND `c`.`form_status` = 2 GROUP BY `a`.`email` ;

-- --------------------------------------------------------

--
-- Structure for view `paid_not_submitted`
--
DROP TABLE IF EXISTS `paid_not_submitted`;

CREATE ALGORITHM=UNDEFINED DEFINER=`u1437096`@`localhost` SQL SECURITY DEFINER VIEW `paid_not_submitted`  AS SELECT `a`.`email` AS `email`, `a`.`full_name` AS `full_name` FROM ((`users` `a` join `payments` `b` on(`a`.`id` = `b`.`participant_id`)) join `participant_statuses` `c` on(`b`.`participant_id` = `c`.`participant_id`)) WHERE `b`.`status` = 2 AND `c`.`form_status` not like 2 GROUP BY `a`.`email` ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `abstracts`
--
ALTER TABLE `abstracts`
  ADD CONSTRAINT `fk_active_version_id` FOREIGN KEY (`active_version_id`) REFERENCES `abstract_versions` (`id`),
  ADD CONSTRAINT `fk_primary_pr_id` FOREIGN KEY (`primary_participant_id`) REFERENCES `participants` (`id`),
  ADD CONSTRAINT `fk_prohram_id_absr` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`),
  ADD CONSTRAINT `fk_selected_subtheem_id` FOREIGN KEY (`program_subtheme_id`) REFERENCES `program_subthemes` (`id`);

--
-- Constraints for table `abstract_authors`
--
ALTER TABLE `abstract_authors`
  ADD CONSTRAINT `fk_author_abstract_id` FOREIGN KEY (`abstract_id`) REFERENCES `abstracts` (`id`),
  ADD CONSTRAINT `fk_part_id_author` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`);

--
-- Constraints for table `abstract_feedbacks`
--
ALTER TABLE `abstract_feedbacks`
  ADD CONSTRAINT `fk_abst_reviewer_id` FOREIGN KEY (`abstract_reviewer_id`) REFERENCES `abstract_reviewers` (`id`),
  ADD CONSTRAINT `fk_abstract_version_id` FOREIGN KEY (`abstract_version_id`) REFERENCES `abstract_versions` (`id`);

--
-- Constraints for table `abstract_papers`
--
ALTER TABLE `abstract_papers`
  ADD CONSTRAINT `fk_paper_abst_id` FOREIGN KEY (`abstract_id`) REFERENCES `abstracts` (`id`);

--
-- Constraints for table `abstract_reviewers`
--
ALTER TABLE `abstract_reviewers`
  ADD CONSTRAINT `fk_rev_prog_id_ab` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `abstract_reviewer_subthemes`
--
ALTER TABLE `abstract_reviewer_subthemes`
  ADD CONSTRAINT `fk_reviewe_abs_sub_id` FOREIGN KEY (`abstract_reviewer_id`) REFERENCES `abstract_reviewers` (`id`),
  ADD CONSTRAINT `fk_sub_prog_rev_id` FOREIGN KEY (`program_subtheme_id`) REFERENCES `program_subthemes` (`id`);

--
-- Constraints for table `abstract_settings`
--
ALTER TABLE `abstract_settings`
  ADD CONSTRAINT `fk_set_absrtact_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `abstract_topics`
--
ALTER TABLE `abstract_topics`
  ADD CONSTRAINT `fk_topic_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `abstract_versions`
--
ALTER TABLE `abstract_versions`
  ADD CONSTRAINT `fk_abs_vre_abs` FOREIGN KEY (`abstract_id`) REFERENCES `abstracts` (`id`);

--
-- Constraints for table `admins`
--
ALTER TABLE `admins`
  ADD CONSTRAINT `fk_admins_admin_roles` FOREIGN KEY (`role_id`) REFERENCES `admin_roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_admins_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `ambassadors`
--
ALTER TABLE `ambassadors`
  ADD CONSTRAINT `fk_ambassador_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `ambassador_participant_referrals`
--
ALTER TABLE `ambassador_participant_referrals`
  ADD CONSTRAINT `fk_amb_part_ref_id` FOREIGN KEY (`ambassador_id`) REFERENCES `ambassadors` (`id`),
  ADD CONSTRAINT `fk_amb_part_refid` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`);

--
-- Constraints for table `competition_categories`
--
ALTER TABLE `competition_categories`
  ADD CONSTRAINT `fk_compcategories_progcategory_id` FOREIGN KEY (`program_category_id`) REFERENCES `program_categories` (`id`),
  ADD CONSTRAINT `fk_pro_da_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `document_invitation`
--
ALTER TABLE `document_invitation`
  ADD CONSTRAINT `fk_document_invitation_program_document_id` FOREIGN KEY (`program_document_id`) REFERENCES `program_documents` (`id`);

--
-- Constraints for table `email_templates`
--
ALTER TABLE `email_templates`
  ADD CONSTRAINT `fk_email_template_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `help_tickets`
--
ALTER TABLE `help_tickets`
  ADD CONSTRAINT `fk_helptickets_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`),
  ADD CONSTRAINT `fk_helptickets_participant` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`);

--
-- Constraints for table `help_ticket_discussions`
--
ALTER TABLE `help_ticket_discussions`
  ADD CONSTRAINT `fk_helpticketdiscussions_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`),
  ADD CONSTRAINT `fk_helpticketdiscussions_helpticket` FOREIGN KEY (`help_ticket_id`) REFERENCES `help_tickets` (`id`),
  ADD CONSTRAINT `fk_helpticketdiscussions_participant` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`);

--
-- Constraints for table `loa_templates`
--
ALTER TABLE `loa_templates`
  ADD CONSTRAINT `fk_doc_loa_id` FOREIGN KEY (`program_document_id`) REFERENCES `program_documents` (`id`);

--
-- Constraints for table `midtrans_payment`
--
ALTER TABLE `midtrans_payment`
  ADD CONSTRAINT `fk_midtrans_participant_id` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`),
  ADD CONSTRAINT `fk_midtrans_payment_id` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_midtrans_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Constraints for table `paper_authors`
--
ALTER TABLE `paper_authors`
  ADD CONSTRAINT `paper_authors_paper_detail` FOREIGN KEY (`paper_detail_id`) REFERENCES `paper_details` (`id`),
  ADD CONSTRAINT `paper_authors_participant` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`);

--
-- Constraints for table `paper_details`
--
ALTER TABLE `paper_details`
  ADD CONSTRAINT `paper_details_paper_abstract` FOREIGN KEY (`paper_abstract_id`) REFERENCES `paper_abstracts` (`id`),
  ADD CONSTRAINT `paper_details_program` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`),
  ADD CONSTRAINT `paper_topic_id` FOREIGN KEY (`paper_topic_id`) REFERENCES `paper_topics` (`id`);

--
-- Constraints for table `paper_program_details`
--
ALTER TABLE `paper_program_details`
  ADD CONSTRAINT `fk_paper_program_details_program` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `paper_reviewers`
--
ALTER TABLE `paper_reviewers`
  ADD CONSTRAINT `fk_paper_reviewers_program` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `paper_reviewer_topics`
--
ALTER TABLE `paper_reviewer_topics`
  ADD CONSTRAINT `fk_reviewer_id` FOREIGN KEY (`paper_reviewer_id`) REFERENCES `paper_reviewers` (`id`),
  ADD CONSTRAINT `fk_topic_id` FOREIGN KEY (`paper_topic_id`) REFERENCES `paper_topics` (`id`);

--
-- Constraints for table `paper_revisions`
--
ALTER TABLE `paper_revisions`
  ADD CONSTRAINT `fk_paper_reviewer_id` FOREIGN KEY (`paper_reviewer_id`) REFERENCES `paper_reviewers` (`id`),
  ADD CONSTRAINT `fk_paper_revisions_paper_detail` FOREIGN KEY (`paper_detail_id`) REFERENCES `paper_details` (`id`);

--
-- Constraints for table `paper_topics`
--
ALTER TABLE `paper_topics`
  ADD CONSTRAINT `fk_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `participants`
--
ALTER TABLE `participants`
  ADD CONSTRAINT `fk_participants_ambassador_ref` FOREIGN KEY (`ref_code_ambassador`) REFERENCES `ambassadors` (`ref_code`),
  ADD CONSTRAINT `fk_participants_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`),
  ADD CONSTRAINT `fk_participants_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `participant_agreement_letters`
--
ALTER TABLE `participant_agreement_letters`
  ADD CONSTRAINT `fk_agreement_letter_participant_id` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`);

--
-- Constraints for table `participant_awards`
--
ALTER TABLE `participant_awards`
  ADD CONSTRAINT `fl_assign_by_award_id` FOREIGN KEY (`assigned_by`) REFERENCES `admins` (`id`),
  ADD CONSTRAINT `participant_awards_ibfk_1` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `participant_awards_ibfk_2` FOREIGN KEY (`award_id`) REFERENCES `program_awards` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `participant_certificates`
--
ALTER TABLE `participant_certificates`
  ADD CONSTRAINT `participant_certificates_ibfk_1` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `participant_certificates_ibfk_2` FOREIGN KEY (`award_id`) REFERENCES `program_awards` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `participant_certificates_ibfk_3` FOREIGN KEY (`certificate_id`) REFERENCES `program_certificates` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `participant_competition_categories`
--
ALTER TABLE `participant_competition_categories`
  ADD CONSTRAINT `fk_partcompcategories_compcategory_id` FOREIGN KEY (`competition_category_id`) REFERENCES `competition_categories` (`id`),
  ADD CONSTRAINT `fk_partcompcategories_participants_id` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Constraints for table `participant_essays`
--
ALTER TABLE `participant_essays`
  ADD CONSTRAINT `fk_partessays_participants_id` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`),
  ADD CONSTRAINT `fk_partessays_progessays_id` FOREIGN KEY (`program_essay_id`) REFERENCES `program_essays` (`id`);

--
-- Constraints for table `participant_program_documents`
--
ALTER TABLE `participant_program_documents`
  ADD CONSTRAINT `fk_partprogramdocuments_participant_id` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`),
  ADD CONSTRAINT `fk_partprogramdocuments_program_document_id` FOREIGN KEY (`program_document_id`) REFERENCES `program_documents` (`id`);

--
-- Constraints for table `participant_statuses`
--
ALTER TABLE `participant_statuses`
  ADD CONSTRAINT `fk_partstatuses_participant_id` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`);

--
-- Constraints for table `participant_subthemes`
--
ALTER TABLE `participant_subthemes`
  ADD CONSTRAINT `fk_partsubthemes_participant_id` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`),
  ADD CONSTRAINT `fk_partsubthemes_progsubtheme_id` FOREIGN KEY (`program_subtheme_id`) REFERENCES `program_subthemes` (`id`);

--
-- Constraints for table `participant_testimonies`
--
ALTER TABLE `participant_testimonies`
  ADD CONSTRAINT `fk_par_test_id` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`),
  ADD CONSTRAINT `fk_prog_test_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `password_resets`
--
ALTER TABLE `password_resets`
  ADD CONSTRAINT `fk_user_pass_reset` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `fk_payments_participant_id` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`),
  ADD CONSTRAINT `fk_payments_payment_method_id` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`),
  ADD CONSTRAINT `fk_payments_program_payment_id` FOREIGN KEY (`program_payment_id`) REFERENCES `program_payments` (`id`);

--
-- Constraints for table `payment_methods`
--
ALTER TABLE `payment_methods`
  ADD CONSTRAINT `fk_payment_methods_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `programs`
--
ALTER TABLE `programs`
  ADD CONSTRAINT `fk_programs_category_id` FOREIGN KEY (`program_category_id`) REFERENCES `program_categories` (`id`);

--
-- Constraints for table `program_announcements`
--
ALTER TABLE `program_announcements`
  ADD CONSTRAINT `fk_program_announcements_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `program_awards`
--
ALTER TABLE `program_awards`
  ADD CONSTRAINT `program_awards_ibfk_1` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `program_categories`
--
ALTER TABLE `program_categories`
  ADD CONSTRAINT `fk_program_categories_program_type` FOREIGN KEY (`program_type_id`) REFERENCES `program_types` (`id`);

--
-- Constraints for table `program_certificates`
--
ALTER TABLE `program_certificates`
  ADD CONSTRAINT `program_certificates_ibfk_1` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `program_certificates_ibfk_2` FOREIGN KEY (`award_id`) REFERENCES `program_awards` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `program_certificate_content_blocks`
--
ALTER TABLE `program_certificate_content_blocks`
  ADD CONSTRAINT `program_certificate_content_blocks_ibfk_1` FOREIGN KEY (`certificate_id`) REFERENCES `program_certificates` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `program_documents`
--
ALTER TABLE `program_documents`
  ADD CONSTRAINT `fk_progdocuments_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `program_document_settings`
--
ALTER TABLE `program_document_settings`
  ADD CONSTRAINT `FK_program_document_settings_programs` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `program_essays`
--
ALTER TABLE `program_essays`
  ADD CONSTRAINT `fk_progessays_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `program_faqs`
--
ALTER TABLE `program_faqs`
  ADD CONSTRAINT `fk_program_faqs_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `program_loas`
--
ALTER TABLE `program_loas`
  ADD CONSTRAINT `fk_loa_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `program_payments`
--
ALTER TABLE `program_payments`
  ADD CONSTRAINT `fk_program_payments_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `program_payment_periods`
--
ALTER TABLE `program_payment_periods`
  ADD CONSTRAINT `program_payment_periods_payment_id_foreign` FOREIGN KEY (`payment_id`) REFERENCES `program_payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `program_photos`
--
ALTER TABLE `program_photos`
  ADD CONSTRAINT `fk_program_photos_program_category_id` FOREIGN KEY (`program_category_id`) REFERENCES `program_categories` (`id`);

--
-- Constraints for table `program_rundowns`
--
ALTER TABLE `program_rundowns`
  ADD CONSTRAINT `fk_rundown_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `program_schedules`
--
ALTER TABLE `program_schedules`
  ADD CONSTRAINT `fk_program_schedules_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `program_sponsors`
--
ALTER TABLE `program_sponsors`
  ADD CONSTRAINT `fk_program_sponsors_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `program_subthemes`
--
ALTER TABLE `program_subthemes`
  ADD CONSTRAINT `fk_progsubthemes_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `program_testimonies`
--
ALTER TABLE `program_testimonies`
  ADD CONSTRAINT `fK_teskt_Porgam_id` FOREIGN KEY (`program_category_id`) REFERENCES `program_categories` (`id`);

--
-- Constraints for table `scores`
--
ALTER TABLE `scores`
  ADD CONSTRAINT `fk_es_participant` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`),
  ADD CONSTRAINT `fk_es_weight` FOREIGN KEY (`score_weight_id`) REFERENCES `score_weights` (`id`);

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_program_category_id` FOREIGN KEY (`program_category_id`) REFERENCES `program_categories` (`id`);

--
-- Constraints for table `web_settings`
--
ALTER TABLE `web_settings`
  ADD CONSTRAINT `fk_setting_web_id` FOREIGN KEY (`program_category_id`) REFERENCES `program_categories` (`id`);

--
-- Constraints for table `web_setting_about`
--
ALTER TABLE `web_setting_about`
  ADD CONSTRAINT `fk_web_setting_about_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `web_setting_home`
--
ALTER TABLE `web_setting_home`
  ADD CONSTRAINT `fk_web_setting_home_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);

--
-- Constraints for table `xendit_payment`
--
ALTER TABLE `xendit_payment`
  ADD CONSTRAINT `fk_xenditpayment_participant` FOREIGN KEY (`participant_id`) REFERENCES `participants` (`id`),
  ADD CONSTRAINT `fk_xenditpayment_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`),
  ADD CONSTRAINT `fk_xenditpayment_programs` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
