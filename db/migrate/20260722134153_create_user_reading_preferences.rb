class CreateUserReadingPreferences < ActiveRecord::Migration[8.1]
  def change
    create_table :user_reading_preferences do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.integer :font_size, default: 14
      t.boolean :night_mode, default: false

      t.timestamps
    end
  end
end
