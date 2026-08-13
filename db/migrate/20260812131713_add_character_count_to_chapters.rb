class AddCharacterCountToChapters < ActiveRecord::Migration[8.1]
  def change
    add_column :chapters, :character_count, :integer
  end
end
