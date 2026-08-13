# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_08_12_131713) do
  create_schema "extensions"

  # These are extensions that must be enabled in order to support this database
  enable_extension "extensions.pg_net"
  enable_extension "extensions.pg_stat_statements"
  enable_extension "extensions.pgcrypto"
  enable_extension "extensions.uuid-ossp"
  enable_extension "pg_catalog.plpgsql"
  enable_extension "vault.supabase_vault"

  create_table "public.active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "public.active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "public.active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "public.author_follows", force: :cascade do |t|
    t.bigint "author_id", null: false
    t.datetime "created_at", null: false
    t.bigint "follower_id", null: false
    t.datetime "updated_at", null: false
    t.index ["author_id"], name: "index_author_follows_on_author_id"
    t.index ["follower_id", "author_id"], name: "index_author_follows_on_follower_id_and_author_id", unique: true
    t.index ["follower_id"], name: "index_author_follows_on_follower_id"
    t.check_constraint "follower_id <> author_id", name: "author_follows_no_self_follow"
  end

  create_table "public.books", force: :cascade do |t|
    t.string "author_name", null: false
    t.decimal "average_rating", precision: 3, scale: 2, default: "0.0"
    t.integer "category", null: false
    t.text "content"
    t.string "cover_color", limit: 7, default: "#8B4513", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.integer "page_count"
    t.datetime "published_at"
    t.integer "ratings_count", default: 0
    t.integer "status", default: 0, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.integer "word_count", default: 0, null: false
    t.index ["category"], name: "index_books_on_category"
    t.index ["status"], name: "index_books_on_status"
    t.index ["user_id", "status"], name: "index_books_on_user_id_and_status"
    t.index ["user_id"], name: "index_books_on_user_id"
  end

  create_table "public.chapters", force: :cascade do |t|
    t.bigint "book_id", null: false
    t.integer "character_count"
    t.text "content"
    t.datetime "created_at", null: false
    t.integer "position", default: 0, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.integer "word_count", default: 0, null: false
    t.index ["book_id", "position"], name: "index_chapters_on_book_id_and_position"
    t.index ["book_id"], name: "index_chapters_on_book_id"
  end

  create_table "public.favorites", force: :cascade do |t|
    t.bigint "book_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["book_id"], name: "index_favorites_on_book_id"
    t.index ["user_id", "book_id"], name: "index_favorites_on_user_id_and_book_id", unique: true
    t.index ["user_id"], name: "index_favorites_on_user_id"
  end

  create_table "public.ratings", force: :cascade do |t|
    t.bigint "book_id", null: false
    t.text "comment"
    t.datetime "created_at", null: false
    t.integer "score", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["book_id", "user_id"], name: "index_ratings_on_book_id_and_user_id", unique: true
    t.index ["book_id"], name: "index_ratings_on_book_id"
    t.index ["user_id"], name: "index_ratings_on_user_id"
    t.check_constraint "score >= 1 AND score <= 5", name: "ratings_score_check"
  end

  create_table "public.reading_progresses", force: :cascade do |t|
    t.bigint "book_id", null: false
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.text "current_position", default: ""
    t.integer "percentage", default: 0, null: false
    t.datetime "started_at"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["book_id"], name: "index_reading_progresses_on_book_id"
    t.index ["user_id", "book_id"], name: "index_reading_progresses_on_user_id_and_book_id", unique: true
    t.index ["user_id"], name: "index_reading_progresses_on_user_id"
    t.check_constraint "percentage >= 0 AND percentage <= 100", name: "reading_progresses_percentage_check"
  end

  create_table "public.user_reading_preferences", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "font_size", default: 14
    t.boolean "night_mode", default: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_user_reading_preferences_on_user_id", unique: true
  end

  create_table "public.users", force: :cascade do |t|
    t.text "bio"
    t.datetime "confirmation_sent_at"
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "created_at", null: false
    t.datetime "current_sign_in_at"
    t.string "current_sign_in_ip"
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.integer "failed_attempts", default: 0, null: false
    t.datetime "last_sign_in_at"
    t.string "last_sign_in_ip"
    t.datetime "locked_at"
    t.string "name"
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.integer "role", default: 0, null: false
    t.integer "sign_in_count", default: 0, null: false
    t.string "unconfirmed_email"
    t.string "unlock_token"
    t.datetime "updated_at", null: false
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["unlock_token"], name: "index_users_on_unlock_token", unique: true
  end

  add_foreign_key "public.active_storage_attachments", "public.active_storage_blobs", column: "blob_id"
  add_foreign_key "public.active_storage_variant_records", "public.active_storage_blobs", column: "blob_id"
  add_foreign_key "public.author_follows", "public.users", column: "author_id"
  add_foreign_key "public.author_follows", "public.users", column: "follower_id"
  add_foreign_key "public.books", "public.users"
  add_foreign_key "public.chapters", "public.books"
  add_foreign_key "public.favorites", "public.books"
  add_foreign_key "public.favorites", "public.users"
  add_foreign_key "public.ratings", "public.books"
  add_foreign_key "public.ratings", "public.users"
  add_foreign_key "public.reading_progresses", "public.books"
  add_foreign_key "public.reading_progresses", "public.users"
  add_foreign_key "public.user_reading_preferences", "public.users"

end
