class CreateBooks < ActiveRecord::Migration[8.1]
  def change
    create_table :books do |t|
      t.references :user, null: false, foreign_key: true
      t.string :title, null: false
      t.string :author_name, null: false
      t.string :cover_color, null: false, default: "#8B4513", limit: 7
      t.text :description
      t.text :content
      t.integer :category, null: false
      t.integer :status, default: 0, null: false
      t.integer :word_count, default: 0, null: false
      t.integer :page_count
      t.decimal :average_rating, precision: 3, scale: 2, default: 0.0
      t.integer :ratings_count, default: 0
      t.datetime :published_at

      t.timestamps
    end

    add_index :books, [ :user_id, :status ]
    add_index :books, :category
    add_index :books, :status
  end
end
