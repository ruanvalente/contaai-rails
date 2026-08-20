class AddChapterTrackingToReadingProgresses < ActiveRecord::Migration[8.1]
  def change
    add_reference :reading_progresses, :current_chapter, foreign_key: { to_table: :chapters }, null: true
    add_column :reading_progresses, :last_read_at, :datetime
  end
end
