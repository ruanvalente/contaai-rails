class AddFieldsToChapters < ActiveRecord::Migration[8.1]
  def change
    add_column :chapters, :published_at, :datetime unless column_exists?(:chapters, :published_at)
  end
end
