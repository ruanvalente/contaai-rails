class CreateRatings < ActiveRecord::Migration[8.1]
  def change
    create_table :ratings do |t|
      t.references :book, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.integer :score, null: false
      t.text :comment

      t.timestamps
    end

    add_check_constraint :ratings, "score >= 1 AND score <= 5", name: "ratings_score_check"
    add_index :ratings, [ :book_id, :user_id ], unique: true
  end
end
