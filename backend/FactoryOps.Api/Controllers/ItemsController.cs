using Microsoft.AspNetCore.Mvc;
using FactoryOps.Api.Database.Models;
using FactoryOps.Api.Database.Models.Frontend;
using FactoryOps.Api.Database.Repositories;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("items")]
public class WorkItemsController(IRepository<Item> itemsRepository) : ControllerBase
{
	[HttpGet]
	public ActionResult<IAsyncEnumerable<ItemDto>> GetAll()
	{
		return Ok(itemsRepository.GetAll()
			.Select(item => new ItemDto(
				item.Id,
				item.Group,
				item.Title,
				item.StartTime.ToString("yyyy-MM-dd:HH:mm:ss"),
				item.Length,
				item.Programmer)));
	}

	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<Item>> Get(int id) => Ok(await itemsRepository.Get(id));

	[HttpPost]
	[Route("insertOrUpdate")]
	public async Task<IActionResult> InsertOrUpdate([FromBody] CreateItemModel workItem)
	{
		var item = new Item
		{
			Group = workItem.Group,
			Title = workItem.Title,
			StartTime = DateTime.Parse(workItem.StartTime).ToUniversalTime(),
			Length = workItem.Length,
			Programmer = workItem.Programmer
		};

		var newItem = await itemsRepository.InsertOrUpdate(item);
		return Ok(newItem);
	}

	[HttpDelete]
	[Route("delete")]
	public async Task<IActionResult> Delete([FromBody] Item item)
	{
		await itemsRepository.Delete(item);
		return Ok();
	}
}
