class CategoriesController < ApplicationController
  def index
    @categories = Book.categories.keys
    @selected_category = params[:category]
    @books = if @selected_category.present?
               Book.published.where(category: @selected_category).includes(:user).order(published_at: :desc)
             else
               Book.published.includes(:user).order(published_at: :desc)
             end
  end
end
