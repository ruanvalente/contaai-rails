class CreateChapters < ActiveRecord::Migration[8.1]
  def change
    create_table :chapters do |t|
      t.references :book, null: false, foreign_key: true
      t.string :title, null: false
      t.text :content
      t.integer :position, null: false, default: 0
      t.integer :word_count, null: false, default: 0

      t.timestamps
    end

    add_index :chapters, [ :book_id, :position ]
  end
end
