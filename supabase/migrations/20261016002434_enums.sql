create extension if not exists citext;
create extension if not exists pg_trgm;

create type user_role as enum ('fan','creator','admin');
create type post_vis as enum ('public','subscribers','paid');
create type post_status as enum ('published','hidden','deleted');
create type media_kind as enum ('image','video');
create type tx_type as enum ('tip','subscription','unlock');
create type tx_status as enum ('pending','success','failed','refunded');
create type sub_status as enum ('pending','active','non_renewing','cancelled','past_due');
create type report_status as enum ('open','actioned','dismissed');