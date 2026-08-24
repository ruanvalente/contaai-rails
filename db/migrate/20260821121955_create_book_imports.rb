class CreateBookImports < ActiveRecord::Migration[8.1]
  def change
    create_table :book_imports do |t|
      t.references :book, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :filename, null: false
      t.integer :status, null: false, default: 0
      t.jsonb :parsed_data, null: false, default: {}
      t.text :error_message

      t.timestamps
    end

    add_index :book_imports, :status
  end
end
