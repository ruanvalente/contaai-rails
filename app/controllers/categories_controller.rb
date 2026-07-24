class CategoriesController < ApplicationController
  def index
    @categories = Book.categories.keys
    @selected_category = params[:category]

    if @selected_category.present?
      @books = Book.published.where(category: @selected_category).includes(:user).order(published_at: :desc)
    else
      @books = Book.published.includes(:user).order(published_at: :desc)
    end
  end
end
