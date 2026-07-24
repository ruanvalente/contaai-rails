class SearchController < ApplicationController
  def index
    @query = params[:q]
    if @query.present?
      @books = Book.published
                   .where("title ILIKE :q OR author_name ILIKE :q OR description ILIKE :q", q: "%#{@query}%")
                   .includes(:user)
                   .order(published_at: :desc)
                   .limit(10)
    else
      @books = Book.none
    end

    respond_to do |format|
      format.html { render "search/index", layout: true }
      format.turbo_stream
    end
  end
end
