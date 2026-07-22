class CreateAuthorFollows < ActiveRecord::Migration[8.1]
  def change
    create_table :author_follows do |t|
      t.references :follower, null: false, foreign_key: { to_table: :users }
      t.references :author, null: false, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_check_constraint :author_follows, "follower_id != author_id", name: "author_follows_no_self_follow"
    add_index :author_follows, [ :follower_id, :author_id ], unique: true
  end
end
