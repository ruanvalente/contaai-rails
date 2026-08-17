class RemovePositionDefaultFromChapters < ActiveRecord::Migration[8.1]
  def change
    change_column_default :chapters, :position, nil
  end
end
