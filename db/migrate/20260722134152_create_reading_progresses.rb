class CreateReadingProgresses < ActiveRecord::Migration[8.1]
  def change
    create_table :reading_progresses do |t|
      t.references :user, null: false, foreign_key: true
      t.references :book, null: false, foreign_key: true
      t.text :current_position, default: ""
      t.integer :percentage, default: 0, null: false
      t.integer :status, default: 0, null: false
      t.datetime :started_at
      t.datetime :completed_at

      t.timestamps
    end

    add_check_constraint :reading_progresses, "percentage >= 0 AND percentage <= 100", name: "reading_progresses_percentage_check"
    add_index :reading_progresses, [ :user_id, :book_id ], unique: true
  end
end
